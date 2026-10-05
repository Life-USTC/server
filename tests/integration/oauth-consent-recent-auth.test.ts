import { makeSignature } from "better-auth/crypto";
import { expect, it } from "vitest";
import { getOAuthCopy } from "@/features/oauth/lib/oauth-copy";
import { submitOAuthConsentAction } from "@/features/oauth/server/oauth-consent-action";
import { getBetterAuthInstance, getSessionFromHeaders } from "@/lib/auth/core";
import { isolatedNodeTest } from "../shared/isolated-node-fixture";
import type { TestPrismaClient } from "../shared/prisma";

const origin = "http://localhost:3000";

async function createConsentFixture(
  db: TestPrismaClient,
  expansion: boolean,
  marker: string,
) {
  const { user, clientId, consent, token, session } = await db.$transaction(
    async (db) => {
      const user = await db.user.create({
        data: {
          id: marker,
          email: `consent-fresh-${marker}@example.test`,
          name: "Consent freshness",
        },
      });
      const clientId = `consent-fresh-${marker}`;
      await db.oAuthClient.create({
        data: {
          clientId,
          name: "Consent freshness",
          public: true,
          tokenEndpointAuthMethod: "none",
          requirePKCE: true,
          redirectUris: ["https://client.example/callback"],
          scopes: ["profile", "email"],
        },
      });
      const consent = expansion
        ? await db.oAuthConsent.create({
            data: { clientId, userId: user.id, scopes: ["profile"] },
          })
        : null;
      const token = crypto.randomUUID();
      const session = await db.session.create({
        data: {
          userId: user.id,
          sessionToken: token,
          expires: new Date(Date.now() + 3_600_000),
        },
      });
      return { user, clientId, consent, token, session };
    },
  );
  const context = await getBetterAuthInstance().$context;
  const signedToken = encodeURIComponent(
    `${token}.${await makeSignature(token, context.secret)}`,
  );
  const query = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: "https://client.example/callback",
    scope: "profile email",
    state: marker,
    prompt: "consent",
    code_challenge: "a".repeat(43),
    code_challenge_method: "S256",
    exp: String(Math.floor(Date.now() / 1000) + 600),
  });
  for (const name of [...new Set([...query.keys(), "ba_param"])].sort())
    query.append("ba_param", name);
  const canonical = new URLSearchParams(
    [...query.entries()].sort(([ak, av], [bk, bv]) =>
      ak < bk ? -1 : ak > bk ? 1 : av < bv ? -1 : av > bv ? 1 : 0,
    ),
  );
  query.set("sig", await makeSignature(canonical.toString(), context.secret));
  const request = new Request(`${origin}/oauth/authorize`, {
    method: "POST",
    headers: {
      cookie: `${context.authCookies.sessionToken.name}=${signedToken}`,
      origin,
    },
    body: new URLSearchParams({
      accept: "true",
      oauthQuery: query.toString(),
      scope: "profile email",
    }),
  });
  return { userId: user.id, clientId, consent, session, request };
}

// Names are maintained here explicitly; the original name remains the
// representative fresh/new-grant case referenced by the manual specification.
for (const { name, expansion, state } of [
  {
    name: "oauth.authorization-management.recent-auth-for-consent",
    expansion: false,
    state: "fresh",
  },
  {
    name: "oauth.authorization-management.recent-auth-for-consent.new.stale",
    expansion: false,
    state: "stale",
  },
  {
    name: "oauth.authorization-management.recent-auth-for-consent.new.boundary",
    expansion: false,
    state: "boundary",
  },
  {
    name: "oauth.authorization-management.recent-auth-for-consent.new.future",
    expansion: false,
    state: "future",
  },
  {
    name: "oauth.authorization-management.recent-auth-for-consent.new.revoked",
    expansion: false,
    state: "revoked",
  },
  {
    name: "oauth.authorization-management.recent-auth-for-consent.new.expired",
    expansion: false,
    state: "expired",
  },
  {
    name: "oauth.authorization-management.recent-auth-for-consent.expansion.fresh",
    expansion: true,
    state: "fresh",
  },
  {
    name: "oauth.authorization-management.recent-auth-for-consent.expansion.stale",
    expansion: true,
    state: "stale",
  },
  {
    name: "oauth.authorization-management.recent-auth-for-consent.expansion.boundary",
    expansion: true,
    state: "boundary",
  },
  {
    name: "oauth.authorization-management.recent-auth-for-consent.expansion.future",
    expansion: true,
    state: "future",
  },
  {
    name: "oauth.authorization-management.recent-auth-for-consent.expansion.revoked",
    expansion: true,
    state: "revoked",
  },
  {
    name: "oauth.authorization-management.recent-auth-for-consent.expansion.expired",
    expansion: true,
    state: "expired",
  },
] as const) {
  isolatedNodeTest(
    name,
    { tags: ["@OAuth/Web"] },
    async ({ isolatedDatabase, nodeRuntime }) =>
      // Own fixture writes and final DB observations as well as each request.
      nodeRuntime.run(async () => {
        const db = isolatedDatabase.owner;
        const f = await nodeRuntime.run(() =>
          createConsentFixture(db, expansion, crypto.randomUUID()),
        );
        // Prime the same per-request session cache used by authenticated request hooks.
        expect(
          (
            await nodeRuntime.run(() =>
              getSessionFromHeaders(f.request.headers),
            )
          )?.user.id,
        ).toBe(f.userId);
        if (state === "revoked")
          await db.session.delete({ where: { id: f.session.id } });
        else if (state === "expired")
          await db.session.update({
            where: { id: f.session.id },
            data: { expires: new Date(0) },
          });
        else if (state !== "fresh")
          await db.session.update({
            where: { id: f.session.id },
            data: {
              createdAt: new Date(
                Date.now() +
                  (state === "future"
                    ? 60_000
                    : state === "boundary"
                      ? -900_000
                      : -1_800_000),
              ),
            },
          });

        // Keep the same Headers identity: the hook cache still contains the
        // original session even after its persisted row changes.
        expect(
          (
            await nodeRuntime.run(() =>
              getSessionFromHeaders(f.request.headers),
            )
          )?.user.id,
        ).toBe(f.userId);
        // A real request boundary drains the denied audit before DB observation.
        const result = await nodeRuntime
          .run(() =>
            submitOAuthConsentAction({
              request: f.request,
            }),
          )
          .catch((error: unknown) => error);
        expect(result).toMatchObject({ status: 303 });
        const location = (result as { location: string }).location;
        const [consent, codes, audits] = await Promise.all([
          db.oAuthConsent.findUnique({
            where: {
              clientId_userId: { clientId: f.clientId, userId: f.userId },
            },
          }),
          db.verificationToken.findMany({
            where: { token: { contains: f.clientId } },
          }),
          db.auditLog.findMany({ where: { oauthClientId: f.clientId } }),
        ]);
        if (state === "fresh") {
          const callback = new URL(location);
          expect(callback.origin).toBe("https://client.example");
          expect(callback.searchParams.get("code")).toBeTruthy();
          expect(consent?.scopes).toEqual(["profile", "email"]);
          if (f.consent) expect(consent?.grantId).toBe(f.consent.grantId);
          expect(codes).toHaveLength(1);
          expect(JSON.parse(codes[0].token)).toMatchObject({
            userId: f.userId,
            sessionId: f.session.id,
            referenceId: consent?.grantId,
          });
          expect(audits).toEqual([
            expect.objectContaining({ outcome: "success", userId: f.userId }),
          ]);
        } else {
          expect(location, `${expansion}:${state}`).toBe(
            "/error?error=recent_auth_required",
          );
          expect(codes).toHaveLength(0);
          expect(consent).toEqual(f.consent);
          if (state === "stale" || state === "boundary" || state === "future") {
            expect(audits).toEqual([
              expect.objectContaining({
                action: expansion
                  ? "oauth_authorization_update"
                  : "oauth_authorization_grant",
                channel: "web",
                outcome: "denied",
                userId: f.userId,
                sessionId: f.session.id,
                metadata: {
                  reason:
                    state === "future"
                      ? "unauthenticated"
                      : "session_not_fresh",
                },
              }),
            ]);
          }
        }
      }),
  );
}
it("oauth.authorization-management.recent-auth-copy", {
  tags: ["@OAuth/Web"],
}, () => {
  expect(getOAuthCopy("en-us").errorRecentAuthRequired).toContain(
    "Sign out, sign in again",
  );
  expect(getOAuthCopy("zh-cn").errorRecentAuthRequired).toContain("重新登录");
});
