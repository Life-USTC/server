import { makeSignature } from "better-auth/crypto";
import { vi } from "vitest";
import { authPostRoute } from "@/lib/api/routes/auth";
import { hashOAuthClientSecretForDbStorage } from "@/lib/oauth/utils";
import { isolatedDatabaseTest } from "./isolated-database";
import { createNodeRuntime } from "./node-runtime";

import { authSecret, providerContext } from "./oauth-continuation-provider";

// The adjacent Vitest redirect controls only provider/session behavior. The
// signed-query verifier and grant binder still execute production code.
vi.mock("@/lib/auth/core");

type ContinuationRuntime = {
  run: ReturnType<typeof createNodeRuntime>["run"];
  request: ReturnType<typeof createNodeRuntime>["run"];
};
type Continuation = {
  marker: string;
  clientId: string;
  userId: string;
  grantId: string;
  signedOAuthQuery: (prompt: string, state: string) => Promise<string>;
  authorize: (request: Request, signedIn?: boolean) => Promise<Response>;
};
export const continuationTest = isolatedDatabaseTest.extend<{
  continuationRuntime: ContinuationRuntime;
  continuation: Continuation;
}>({
  continuationRuntime: async ({ isolatedDatabase }, use) => {
    const { connections } = isolatedDatabase;
    const env = {
      APP_PUBLIC_ORIGIN: "https://life.example",
      HYPERDRIVE: { connectionString: connections.app },
      HYPERDRIVE_AUTH: { connectionString: connections.auth },
    };
    const lifetime = createNodeRuntime(env);
    const requests = createNodeRuntime(env);
    const failures: unknown[] = [];
    try {
      await use({ run: lifetime.run, request: requests.run });
    } catch (error) {
      failures.push(error);
    }
    // Drain full setup/body callbacks before rejecting new inner requests.
    const results = await Promise.allSettled([lifetime.close()]);
    results.push(...(await Promise.allSettled([requests.close()])));
    failures.push(
      ...results.flatMap((result) =>
        result.status === "rejected" ? [result.reason] : [],
      ),
    );
    if (failures.length)
      throw new AggregateError(failures, "OAuth continuation cleanup failed");
  },
  continuation: async (
    { isolatedDatabase: { owner: fixturePrisma }, continuationRuntime },
    use,
  ) => {
    const fixture = await continuationRuntime.run(async () => {
      const marker = crypto.randomUUID();
      const clientId = `oauth-continuation-${marker}`;
      const { userId, grantId } = await fixturePrisma.$transaction(
        async (tx) => {
          const user = await tx.user.create({
            data: {
              email: `oauth-continuation-${marker}@example.test`,
              name: "OAuth continuation user",
            },
            select: { id: true },
          });
          await tx.oAuthClient.create({
            data: {
              clientId,
              name: "OAuth continuation client",
              redirectUris: ["https://client.example/callback"],
              scopes: ["profile"],
            },
          });
          const consent = await tx.oAuthConsent.create({
            data: {
              clientId,
              scopes: ["profile"],
              userId: user.id,
              // This continuation starts with an already-existing consent.
              updatedAt: new Date(Date.now() - 60_000),
            },
            select: { grantId: true },
          });
          return { userId: user.id, grantId: consent.grantId };
        },
      );
      async function signedOAuthQuery(prompt: string, state: string) {
        const query = new URLSearchParams({
          response_type: "code",
          client_id: clientId,
          redirect_uri: "https://client.example/callback",
          scope: "profile",
          state,
          prompt,
          code_challenge: "integration-code-challenge",
          code_challenge_method: "S256",
          exp: String(Math.floor(Date.now() / 1000) + 600),
        });
        for (const name of [...new Set([...query.keys(), "ba_param"])].sort()) {
          query.append("ba_param", name);
        }
        const canonical = new URLSearchParams(
          [...query.entries()].sort(([keyA, valueA], [keyB, valueB]) => {
            if (keyA < keyB) return -1;
            if (keyA > keyB) return 1;
            if (valueA < valueB) return -1;
            if (valueA > valueB) return 1;
            return 0;
          }),
        );
        query.set("sig", await makeSignature(canonical.toString(), authSecret));
        return query.toString();
      }

      async function issueCode(request: Request) {
        const body = (await request.clone().json()) as {
          oauth_query: string;
        };
        const signed = new URLSearchParams(body.oauth_query);
        const state = signed.get("state") ?? "";
        for (const field of ["sig", "exp", "ba_iat", "ba_pl", "ba_param"]) {
          signed.delete(field);
        }
        const code = `continuation-${state}-${marker}`;
        const identifier = await hashOAuthClientSecretForDbStorage(code);
        await fixturePrisma.verificationToken.create({
          data: {
            identifier,
            token: JSON.stringify({
              type: "authorization_code",
              query: Object.fromEntries(signed.entries()),
              userId,
              sessionId: `session-${marker}`,
            }),
            expires: new Date(Date.now() + 10 * 60 * 1000),
          },
        });
        return Response.json({
          redirect: true,
          url: `https://client.example/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
        });
      }
      return {
        marker,
        clientId,
        userId,
        grantId,
        signedOAuthQuery,
        authorize: (request: Request, signedIn = true) =>
          continuationRuntime.request(() =>
            providerContext.run(
              Object.freeze({ userId, signedIn, issueCode }),
              () => authPostRoute(request),
            ),
          ),
      };
    });
    await use(fixture);
  },
});
