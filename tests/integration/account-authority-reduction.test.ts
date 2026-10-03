import { makeSignature } from "better-auth/crypto";
import { describe } from "vitest";
import { updateUserOAuthAuthorizationScopes } from "@/features/oauth/server/user-authorizations.server";
import { revokeSettingsAuthorizationAction } from "@/features/settings/server/settings-authorization-actions";
import { authPostRoute } from "@/lib/api/routes/auth";
import { getBetterAuthInstance, getSessionFromHeaders } from "@/lib/auth/core";
import type { Prisma } from "../../src/generated/prisma-node/client";
import { nodeProtocolTest as it } from "../shared/node-protocol-fixture";

const origin = "http://localhost:3000";

async function user(db: Prisma.TransactionClient) {
  const value = await db.user.create({
    data: {
      email: `authority-reduction-${crypto.randomUUID()}@example.test`,
      name: "[integration-test] Authority reduction",
    },
  });
  return value.id;
}

// Database-only arrangement; signing happens after the transaction commits.
async function session(
  db: Prisma.TransactionClient,
  userId: string,
  minutesOld = 30,
) {
  const token = crypto.randomUUID();
  const row = await db.session.create({
    data: {
      userId,
      sessionToken: token,
      createdAt: new Date(Date.now() - minutesOld * 60_000),
      expires: new Date(Date.now() + 60 * 60_000),
    },
  });
  return { id: row.id, token };
}

async function signedSession(row: Awaited<ReturnType<typeof session>>) {
  const context = await getBetterAuthInstance().$context;
  const signed = encodeURIComponent(
    `${row.token}.${await makeSignature(row.token, context.secret)}`,
  );
  return {
    ...row,
    cookie: `${context.authCookies.sessionToken.name}=${signed}`,
  };
}

async function grant(
  db: Prisma.TransactionClient,
  userId: string,
  scopes = ["profile", "email"],
) {
  const clientId = `authority-client-${crypto.randomUUID()}`;
  await db.oAuthClient.create({
    data: {
      clientId,
      name: "[integration-test] Delegated client",
      scopes: ["profile", "email"],
      redirectUris: ["https://client.example/callback"],
      skipConsent: false,
    },
  });
  return db.oAuthConsent.create({ data: { userId, clientId, scopes } });
}

function request(
  path: string,
  cookie: string,
  body: unknown,
  requestOrigin = origin,
) {
  return new Request(`${origin}/api/auth${path}`, {
    method: "POST",
    headers: {
      cookie,
      origin: requestOrigin,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function settingsRevoke(
  cookie: string,
  consentId: string,
  requestOrigin = origin,
) {
  return revokeSettingsAuthorizationAction({
    locale: "en-us",
    request: new Request(
      `${origin}/account/settings/authorizations?/revokeAuthorization`,
      {
        method: "POST",
        headers: { cookie, origin: requestOrigin },
        body: new URLSearchParams({ consentId }),
      },
    ),
    url: new URL(`${origin}/account/settings/authorizations`),
  });
}

describe("account authority reduction boundaries", () => {
  it("user.session-revocation-valid-session", async ({
    isolatedDatabase: { owner: fixtures },
    protocolRuntime,
    expect,
  }) => {
    await protocolRuntime.run(async () => {
      for (const path of [
        "/revoke-session",
        "/revoke-other-sessions",
        "/revoke-sessions",
      ]) {
        const { actorRow, target, other } = await fixtures.$transaction(
          async (db) => {
            const userId = await user(db);
            return {
              actorRow: await session(db, userId),
              target: await session(db, userId),
              other: await session(db, await user(db)),
            };
          },
        );
        const actor = await signedSession(actorRow);
        const response = await protocolRuntime.request(() =>
          authPostRoute(request(path, actor.cookie, { token: target.token })),
        );
        expect(response.status).toBe(200);
        expect(
          await fixtures.session.findUnique({ where: { id: target.id } }),
        ).toBeNull();
        expect(await fixtures.session.count({ where: { id: other.id } })).toBe(
          1,
        );
        expect(await fixtures.session.count({ where: { id: actor.id } })).toBe(
          path === "/revoke-sessions" ? 0 : 1,
        );
      }
    });
  });

  it("user.session-revocation-ownership", async ({
    isolatedDatabase: { owner: fixtures },
    protocolRuntime,
    expect,
  }) => {
    await protocolRuntime.run(async () => {
      const { actorRow, other } = await fixtures.$transaction(async (db) => ({
        actorRow: await session(db, await user(db)),
        other: await session(db, await user(db)),
      }));
      const actor = await signedSession(actorRow);
      const response = await protocolRuntime.request(() =>
        authPostRoute(
          request("/revoke-session", actor.cookie, { token: other.token }),
        ),
      );
      expect(response.status).toBe(200);
      expect(await fixtures.session.count({ where: { id: other.id } })).toBe(1);
      expect(await fixtures.session.count({ where: { id: actor.id } })).toBe(1);
    });
  });

  it("user.session-revocation-origin", async ({
    isolatedDatabase: { owner: fixtures },
    protocolRuntime,
    expect,
  }) => {
    await protocolRuntime.run(async () => {
      for (const path of [
        "/revoke-session",
        "/revoke-other-sessions",
        "/revoke-sessions",
      ]) {
        const { userId, actorRow, target } = await fixtures.$transaction(
          async (db) => {
            const userId = await user(db);
            return {
              userId,
              actorRow: await session(db, userId),
              target: await session(db, userId),
            };
          },
        );
        const actor = await signedSession(actorRow);
        const response = await protocolRuntime.request(() =>
          authPostRoute(
            request(
              path,
              actor.cookie,
              { token: target.token },
              "https://untrusted.example",
            ),
          ),
        );
        expect(response.status).toBe(403);
        expect(await fixtures.session.count({ where: { userId } })).toBe(2);
      }
    });
  });

  it("user.session-revocation-authoritative", async ({
    isolatedDatabase: { owner: fixtures },
    protocolRuntime,
    expect,
  }) => {
    await protocolRuntime.run(async () => {
      for (const path of [
        "/revoke-session",
        "/revoke-other-sessions",
        "/revoke-sessions",
      ]) {
        const { actorRow, target } = await fixtures.$transaction(async (db) => {
          const userId = await user(db);
          return {
            userId,
            actorRow: await session(db, userId),
            target: await session(db, userId),
          };
        });
        const actor = await signedSession(actorRow);
        await fixtures.session.delete({ where: { id: actor.id } });
        const response = await protocolRuntime.request(() =>
          authPostRoute(request(path, actor.cookie, { token: target.token })),
        );
        expect(response.status).toBe(401);
        expect(await fixtures.session.count({ where: { id: target.id } })).toBe(
          1,
        );
      }
    });
  });

  it("oauth.authorization-revoke-valid-session", async ({
    isolatedDatabase: { owner: fixtures },
    protocolRuntime,
    expect,
  }) => {
    await protocolRuntime.run(async () => {
      const { actorRow, apiGrant, webGrant } = await fixtures.$transaction(
        async (db) => {
          const userId = await user(db);
          return {
            actorRow: await session(db, userId),
            apiGrant: await grant(db, userId),
            webGrant: await grant(db, userId),
          };
        },
      );
      const actor = await signedSession(actorRow);
      const response = await protocolRuntime.request(() =>
        authPostRoute(
          request("/oauth2/delete-consent", actor.cookie, { id: apiGrant.id }),
        ),
      );
      expect(response.status).toBe(200);
      expect(
        await fixtures.oAuthConsent.findUnique({ where: { id: apiGrant.id } }),
      ).toBeNull();
      await expect(
        protocolRuntime.request(() =>
          settingsRevoke(actor.cookie, webGrant.id),
        ),
      ).rejects.toMatchObject({
        status: 303,
        location:
          "/account/settings/authorizations?message=AuthorizationRevoked",
      });
      expect(
        await fixtures.oAuthConsent.findUnique({ where: { id: webGrant.id } }),
      ).toBeNull();
    });
  });

  it("oauth.authorization-reduction-ownership", async ({
    isolatedDatabase: { owner: fixtures },
    protocolRuntime,
    expect,
  }) => {
    await protocolRuntime.run(async () => {
      const { actorRow, otherGrant } = await fixtures.$transaction(
        async (db) => ({
          actorRow: await session(db, await user(db)),
          otherGrant: await grant(db, await user(db)),
        }),
      );
      const actor = await signedSession(actorRow);
      for (const path of ["/oauth2/delete-consent", "/oauth2/update-consent"]) {
        const response = await protocolRuntime.request(() =>
          authPostRoute(
            request(path, actor.cookie, {
              id: otherGrant.id,
              update: { scopes: [] },
            }),
          ),
        );
        expect(response.status).toBe(404);
      }
      expect(
        await protocolRuntime.request(() =>
          settingsRevoke(actor.cookie, otherGrant.id),
        ),
      ).toMatchObject({
        status: 404,
      });
      expect(
        await fixtures.oAuthConsent.findUnique({
          where: { id: otherGrant.id },
        }),
      ).toMatchObject({
        grantId: otherGrant.grantId,
        scopes: ["profile", "email"],
      });
    });
  });

  it("oauth.authorization-reduction-origin", async ({
    isolatedDatabase: { owner: fixtures },
    protocolRuntime,
    expect,
  }) => {
    await protocolRuntime.run(async () => {
      const { actorRow, owned } = await fixtures.$transaction(async (db) => {
        const userId = await user(db);
        return {
          userId,
          actorRow: await session(db, userId),
          owned: await grant(db, userId),
        };
      });
      const actor = await signedSession(actorRow);
      for (const path of ["/oauth2/delete-consent", "/oauth2/update-consent"]) {
        const response = await protocolRuntime.request(() =>
          authPostRoute(
            request(
              path,
              actor.cookie,
              { id: owned.id, update: { scopes: [] } },
              "https://untrusted.example",
            ),
          ),
        );
        expect(response.status).toBe(403);
      }
      await expect(
        protocolRuntime.request(() =>
          settingsRevoke(actor.cookie, owned.id, "https://untrusted.example"),
        ),
      ).rejects.toMatchObject({ status: 403 });
      expect(
        await fixtures.oAuthConsent.findUnique({ where: { id: owned.id } }),
      ).toMatchObject({ grantId: owned.grantId, scopes: ["profile", "email"] });
    });
  });

  it("oauth.authorization-reduction-authoritative", async ({
    isolatedDatabase: { owner: fixtures },
    protocolRuntime,
    expect,
  }) => {
    await protocolRuntime.run(async () => {
      for (const state of ["revoked", "expired"] as const) {
        for (const path of [
          "/oauth2/delete-consent",
          "/oauth2/update-consent",
        ]) {
          const { userId, actorRow, owned } = await fixtures.$transaction(
            async (db) => {
              const userId = await user(db);
              return {
                userId,
                actorRow: await session(db, userId),
                owned: await grant(db, userId),
              };
            },
          );
          const actor = await signedSession(actorRow);
          await protocolRuntime.request(async () => {
            const incoming = request(path, actor.cookie, {
              id: owned.id,
              update: { scopes: [] },
            });
            expect(
              (await getSessionFromHeaders(incoming.headers))?.user.id,
            ).toBe(userId);
            if (state === "revoked")
              await fixtures.session.delete({ where: { id: actor.id } });
            else
              await fixtures.session.update({
                where: { id: actor.id },
                data: { expires: new Date(0) },
              });
            const response = await authPostRoute(incoming);
            expect(response.status).toBe(401);
            expect(
              await fixtures.oAuthConsent.findUnique({
                where: { id: owned.id },
              }),
            ).toMatchObject({
              grantId: owned.grantId,
              scopes: ["profile", "email"],
            });
            return response;
          });
        }
      }
    });
  });

  it("oauth.authorization-reduce-valid-session", async ({
    isolatedDatabase: { owner: fixtures },
    protocolRuntime,
    expect,
  }) => {
    await protocolRuntime.run(async () => {
      const { userId, actorRow, owned } = await fixtures.$transaction(
        async (db) => {
          const userId = await user(db);
          const actorRow = await session(db, userId);
          const owned = await grant(db, userId);
          await db.oAuthAccessToken.create({
            data: {
              clientId: owned.clientId,
              grantId: owned.grantId,
              userId,
              token: crypto.randomUUID(),
              scopes: owned.scopes,
              expiresAt: new Date(Date.now() + 60_000),
            },
          });
          return { userId, actorRow, owned };
        },
      );
      const actor = await signedSession(actorRow);
      const response = await protocolRuntime.request(() =>
        authPostRoute(
          request("/oauth2/update-consent", actor.cookie, {
            id: owned.id,
            update: { scopes: ["profile"] },
          }),
        ),
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        id: owned.id,
        scopes: ["profile"],
      });
      const reduced = await fixtures.oAuthConsent.findUniqueOrThrow({
        where: { id: owned.id },
      });
      expect(reduced.grantId).not.toBe(owned.grantId);
      expect(reduced.scopes).toEqual(["profile"]);
      expect(
        await fixtures.oAuthAccessToken.count({
          where: { clientId: owned.clientId, userId },
        }),
      ).toBe(0);
    });
  });

  it("oauth.authorization-reduce-no-expansion", async ({
    isolatedDatabase: { owner: fixtures },
    protocolRuntime,
    expect,
  }) => {
    await protocolRuntime.run(async () => {
      for (const minutesOld of [0, 30]) {
        const { actorRow, owned } = await fixtures.$transaction(async (db) => {
          const userId = await user(db);
          return {
            actorRow: await session(db, userId, minutesOld),
            owned: await grant(db, userId, ["profile"]),
          };
        });
        const actor = await signedSession(actorRow);
        const response = await protocolRuntime.request(() =>
          authPostRoute(
            request("/oauth2/update-consent", actor.cookie, {
              id: owned.id,
              update: { scopes: ["profile", "email"] },
            }),
          ),
        );
        expect(response.status).toBe(400);
        expect(
          await fixtures.oAuthConsent.findUnique({ where: { id: owned.id } }),
        ).toMatchObject({ grantId: owned.grantId, scopes: ["profile"] });
      }
    });
  });

  it("oauth.authorization-reduce-concurrent", async ({
    isolatedDatabase: { owner: fixtures },
    protocolRuntime,
    expect,
  }) => {
    await protocolRuntime.run(async () => {
      const { userId, owned } = await fixtures.$transaction(async (db) => {
        const userId = await user(db);
        return { userId, owned: await grant(db, userId) };
      });
      const results = await Promise.all([
        protocolRuntime.request(() =>
          updateUserOAuthAuthorizationScopes(userId, owned.id, ["profile"]),
        ),
        protocolRuntime.request(() =>
          updateUserOAuthAuthorizationScopes(userId, owned.id, ["email"]),
        ),
      ]);
      expect(results.filter((result) => result.ok)).toHaveLength(1);
      expect(results.filter((result) => !result.ok)).toEqual([
        { ok: false, reason: "invalid_scope" },
      ]);
      const persisted = await fixtures.oAuthConsent.findUniqueOrThrow({
        where: { id: owned.id },
      });
      expect(persisted.scopes).toHaveLength(1);
      expect(persisted.grantId).not.toBe(owned.grantId);
    });
  });
});
