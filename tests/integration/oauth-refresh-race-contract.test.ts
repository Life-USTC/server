import { decodeJwt } from "jose";
import { expect, vi } from "vitest";
import { revokeUserOAuthAuthorization } from "@/features/oauth/server/user-authorizations.server";
import { tokenPostRoute } from "@/lib/api/routes/auth-token";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { OAUTH_GRANT_ID_CLAIM } from "@/lib/oauth/constants";
import { getCanonicalOAuthIssuer } from "@/lib/oauth/resource-urls";
import { hashOAuthClientSecretForDbStorage } from "@/lib/oauth/utils";
import { createDeferred } from "../shared/deferred";
import { oauthProviderTest } from "../shared/oauth-provider-runtime";

const scope = ["profile", "offline_access"];

function request(clientId: string, raw: string, resources: string[]) {
  const params = new URLSearchParams({
    client_id: clientId,
    grant_type: "refresh_token",
    refresh_token: raw,
  });
  for (const resource of resources) params.append("resource", resource);
  return new Request(`${getCanonicalOAuthIssuer()}/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params,
  });
}

oauthProviderTest(
  "oauth.authorization-management.refresh-revocation-race",
  { tags: ["@OAuth/OAuth"], timeout: 30000 },
  async ({ isolatedDatabase: { owner: db }, oauthRuntime }) => {
    await oauthRuntime.run(async () => {
      const marker = crypto.randomUUID();
      async function seed(format: string) {
        return db.$transaction(async (tx) => {
          const userId = `refresh-race-${format}-${marker}`;
          const clientId = `refresh-race-client-${format}-${marker}`;
          await tx.user.create({
            data: { id: userId, email: `${userId}@example.test` },
          });
          await tx.oAuthClient.create({
            data: {
              clientId,
              name: marker,
              tokenEndpointAuthMethod: "none",
              grantTypes: ["refresh_token"],
              scopes: scope,
              redirectUris: [],
            },
          });
          const resources = format === "jwt" ? [getCanonicalOAuthIssuer()] : [];
          const consent = await tx.oAuthConsent.create({
            data: { userId, clientId, scopes: scope, resources },
          });
          const raw = crypto.randomUUID();
          await tx.oAuthRefreshToken.create({
            data: {
              userId,
              clientId,
              token: await hashOAuthClientSecretForDbStorage(raw),
              grantId: consent.grantId,
              referenceId: consent.grantId,
              scopes: scope,
              resources,
              authTime: new Date(),
              expiresAt: new Date(Date.now() + 3600000),
            },
          });
          return { userId, clientId, consent, raw, resources };
        });
      }
      for (const format of ["jwt", "opaque"]) {
        const identity = await seed(format);
        const first = await oauthRuntime.request(() =>
          tokenPostRoute(
            request(identity.clientId, identity.raw, identity.resources),
          ),
        );
        const issued = await first.json();
        expect(first.status, JSON.stringify(issued)).toBe(200);
        expect(typeof issued.refresh_token).toBe("string");
        const refreshHash = await hashOAuthClientSecretForDbStorage(
          issued.refresh_token,
        );
        const rotated = await db.oAuthRefreshToken.findUniqueOrThrow({
          where: { token: refreshHash },
        });
        expect(rotated.grantId ?? rotated.referenceId).toBe(
          identity.consent.grantId,
        );
        expect(rotated.scopes).toEqual(scope);
        if (format === "jwt")
          expect(decodeJwt(issued.access_token)[OAUTH_GRANT_ID_CLAIM]).toBe(
            identity.consent.grantId,
          );
        else {
          expect(issued.access_token.split(".")).not.toHaveLength(3);
          expect(
            await db.oAuthAccessToken.findUniqueOrThrow({
              where: {
                token: await hashOAuthClientSecretForDbStorage(
                  issued.access_token,
                ),
              },
            }),
          ).toMatchObject({
            grantId: identity.consent.grantId,
            referenceId: identity.consent.grantId,
            scopes: scope,
          });
        }

        const auth = getBetterAuthInstance();
        const original = auth.handler.bind(auth);
        const reached = createDeferred<Response>();
        const release = createDeferred<void>();
        const provider = vi
          .spyOn(auth, "handler")
          .mockImplementation(async (incoming) => {
            const response = await original(incoming);
            reached.resolve(await oauthRuntime.request(() => response.clone()));
            await release.promise;
            return response;
          });
        const pending = Promise.resolve(
          oauthRuntime.request(() =>
            tokenPostRoute(
              request(
                identity.clientId,
                issued.refresh_token,
                identity.resources,
              ),
            ),
          ),
        );
        try {
          const minted = await Promise.race([
            reached.promise,
            pending.then(() => {
              throw new Error(
                "Refresh returned before reaching provider barrier",
              );
            }),
          ]);
          expect(minted.status, await minted.clone().text()).toBe(200);
          const mintedBody = await minted.json();
          expect(typeof mintedBody.access_token).toBe("string");
          expect(
            await revokeUserOAuthAuthorization(
              identity.userId,
              identity.consent.id,
            ),
          ).toMatchObject({ ok: true });
          const replacement = await db.oAuthConsent.create({
            data: {
              userId: identity.userId,
              clientId: identity.clientId,
              scopes: scope,
              resources: identity.resources,
            },
          });
          const replacementRefresh = await db.oAuthRefreshToken.create({
            data: {
              userId: identity.userId,
              clientId: identity.clientId,
              token: crypto.randomUUID(),
              grantId: replacement.grantId,
              referenceId: replacement.grantId,
              scopes: scope,
              resources: identity.resources,
              expiresAt: new Date(Date.now() + 3600000),
            },
          });
          const replacementAccess = await db.oAuthAccessToken.create({
            data: {
              userId: identity.userId,
              clientId: identity.clientId,
              token: crypto.randomUUID(),
              grantId: replacement.grantId,
              referenceId: replacement.grantId,
              refreshId: replacementRefresh.id,
              scopes: scope,
              expiresAt: new Date(Date.now() + 600000),
            },
          });
          release.resolve();
          const result = await pending;
          const body = await result.json();
          expect(result.status).toBe(400);
          expect(body.error).toBe("invalid_grant");
          expect(body).not.toHaveProperty("access_token");
          expect(body).not.toHaveProperty("refresh_token");
          expect(
            await db.oAuthRefreshToken.count({
              where: {
                clientId: identity.clientId,
                OR: [
                  { grantId: identity.consent.grantId },
                  { referenceId: identity.consent.grantId },
                ],
              },
            }),
          ).toBe(0);
          expect(
            await db.oAuthAccessToken.count({
              where: {
                clientId: identity.clientId,
                OR: [
                  { grantId: identity.consent.grantId },
                  { referenceId: identity.consent.grantId },
                ],
              },
            }),
          ).toBe(0);
          expect(
            await db.oAuthRefreshToken.findUnique({
              where: { id: replacementRefresh.id },
            }),
          ).toEqual(replacementRefresh);
          expect(
            await db.oAuthAccessToken.findUnique({
              where: { id: replacementAccess.id },
            }),
          ).toEqual(replacementAccess);
          expect(
            await db.oAuthConsent.findUnique({ where: { id: replacement.id } }),
          ).toEqual(replacement);
        } finally {
          release.resolve();
          try {
            await pending;
          } finally {
            provider.mockRestore();
          }
        }
      }
    });
  },
);
