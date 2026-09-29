import { makeSignature } from "better-auth/crypto";
import { vi } from "vitest";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { getOAuthMcpResourceUrl } from "@/lib/oauth/resource-urls";
import { isolatedDatabaseTest } from "./isolated-database";
import { createNodeRuntime } from "./node-runtime";

const origin = "http://localhost:3000";
type ObservationRuntime = {
  run: ReturnType<typeof createNodeRuntime>["run"];
  request: ReturnType<typeof createNodeRuntime>["run"];
  writeDataPoint: ReturnType<typeof vi.fn>;
};

// Each consumer has one test in an isolated Vitest file: Better Auth and its
// identifier-keyed resource cache belong to that process, not just its database.
export const oauthObservationTest = isolatedDatabaseTest.extend<{
  observationRuntime: ObservationRuntime;
  observation: {
    marker: string;
    userId: string;
    clientId: string;
    cookie: string;
  };
}>({
  observationRuntime: async ({ isolatedDatabase }, use) => {
    const { connections } = isolatedDatabase;
    const writeDataPoint = vi.fn();
    const env = {
      APP_PUBLIC_ORIGIN: origin,
      HYPERDRIVE: { connectionString: connections.app },
      HYPERDRIVE_AUTH: { connectionString: connections.auth },
      ANALYTICS: { writeDataPoint },
    };
    const lifetime = createNodeRuntime(env);
    const requests = createNodeRuntime(env);
    const failures: unknown[] = [];
    try {
      // Register ownership before dependent setup can time out.
      await use({ run: lifetime.run, request: requests.run, writeDataPoint });
    } catch (error) {
      failures.push(error);
    }
    // Admitted callbacks may issue further requests after the runner times out.
    const results = await Promise.allSettled([lifetime.close()]);
    results.push(...(await Promise.allSettled([requests.close()])));
    failures.push(
      ...results.flatMap((result) =>
        result.status === "rejected" ? [result.reason] : [],
      ),
    );
    if (failures.length)
      throw new AggregateError(failures, "OAuth observation cleanup failed");
  },
  observation: async (
    { isolatedDatabase: { owner: db }, observationRuntime },
    use,
  ) => {
    const state = await observationRuntime.run(async () => {
      const marker = crypto.randomUUID();
      const userId = `token-observation-${marker}`;
      const clientId = `token-observation-client-${marker}`;
      const token = crypto.randomUUID();
      await db.$transaction(async (tx) => {
        await tx.user.create({
          data: { id: userId, email: `${userId}@example.test`, isAdmin: true },
        });
        await tx.oAuthClient.create({
          data: {
            clientId,
            name: marker,
            tokenEndpointAuthMethod: "none",
            redirectUris: ["https://client.example/callback"],
            grantTypes: ["authorization_code"],
            responseTypes: ["code"],
            scopes: ["profile"],
          },
        });
        await tx.session.create({
          data: {
            userId,
            sessionToken: token,
            expires: new Date(Date.now() + 3600000),
          },
        });
      });
      const cookie = await observationRuntime.request(async () => {
        const context = await getBetterAuthInstance().$context;
        return `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${token}.${await makeSignature(token, context.secret)}`)}`;
      });
      return { marker, userId, clientId, cookie };
    });
    await use(state);
  },
});

export function tokenRequest(clientId: string) {
  return new Request(`${origin}/api/auth/oauth2/token`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      origin,
      authorization: "Basic private-authorization",
      cookie: "private-cookie",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: "private-code",
      code_verifier: "private-verifier",
      client_id: clientId,
      client_secret: "private-secret",
      refresh_token: "private-refresh",
      resource: getOAuthMcpResourceUrl(),
    }),
  });
}
