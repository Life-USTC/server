import { afterAll, describe, expect, it } from "vitest";
import { updateUserOAuthAuthorizationScopes } from "@/features/oauth/server/user-authorizations.server";
import { revokeSettingsAuthorizationAction } from "@/features/settings/server/settings-authorization-actions";
import { authPostRoute } from "@/lib/api/routes/auth";
import { getBetterAuthInstance, getSessionFromHeaders } from "@/lib/auth/core";
import { authPrisma } from "@/lib/db/auth-prisma";
import { prisma as runtimePrisma } from "@/lib/db/prisma";
import { createFixturePrisma } from "../shared/prisma";

const fixtures = createFixturePrisma();
const origin = "http://localhost:3000";
const userIds: string[] = [];
const clientIds: string[] = [];

async function user() {
  const value = await fixtures.user.create({
    data: {
      email: `authority-reduction-${crypto.randomUUID()}@example.test`,
      name: "[integration-test] Authority reduction",
    },
  });
  userIds.push(value.id);
  return value.id;
}

async function session(userId: string, minutesOld = 30) {
  const token = crypto.randomUUID();
  const row = await fixtures.session.create({
    data: {
      userId,
      sessionToken: token,
      createdAt: new Date(Date.now() - minutesOld * 60_000),
      expires: new Date(Date.now() + 60 * 60_000),
    },
  });
  const context = await getBetterAuthInstance().$context;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(context.secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(token)),
  );
  const signed = encodeURIComponent(
    `${token}.${btoa(String.fromCharCode(...signature))}`,
  );
  return {
    id: row.id,
    token,
    cookie: `${context.authCookies.sessionToken.name}=${signed}`,
  };
}

async function grant(userId: string, scopes = ["profile", "email"]) {
  const clientId = `authority-client-${crypto.randomUUID()}`;
  clientIds.push(clientId);
  await fixtures.oAuthClient.create({
    data: {
      clientId,
      name: "[integration-test] Delegated client",
      scopes: ["profile", "email"],
      redirectUris: ["https://client.example/callback"],
      skipConsent: false,
    },
  });
  return fixtures.oAuthConsent.create({ data: { userId, clientId, scopes } });
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

describe("account authority reduction boundaries", {
  concurrent: false,
}, () => {
  afterAll(async () => {
    await fixtures.auditLog.deleteMany({
      where: {
        OR: [{ userId: { in: userIds } }, { subjectUserId: { in: userIds } }],
      },
    });
    await fixtures.oAuthClient.deleteMany({
      where: { clientId: { in: clientIds } },
    });
    await fixtures.user.deleteMany({ where: { id: { in: userIds } } });
    await Promise.all([
      fixtures.$disconnect(),
      authPrisma.$disconnect(),
      runtimePrisma.$disconnect(),
    ]);
  });

  it("user.session-revocation-valid-session", async () => {
    for (const path of [
      "/revoke-session",
      "/revoke-other-sessions",
      "/revoke-sessions",
    ]) {
      const userId = await user();
      const actor = await session(userId);
      const target = await session(userId);
      const other = await session(await user());
      const response = await authPostRoute(
        request(path, actor.cookie, { token: target.token }),
      );
      expect(response.status).toBe(200);
      expect(
        await fixtures.session.findUnique({ where: { id: target.id } }),
      ).toBeNull();
      expect(await fixtures.session.count({ where: { id: other.id } })).toBe(1);
      expect(await fixtures.session.count({ where: { id: actor.id } })).toBe(
        path === "/revoke-sessions" ? 0 : 1,
      );
    }
  });

  it("user.session-revocation-ownership", async () => {
    const actor = await session(await user());
    const other = await session(await user());
    const response = await authPostRoute(
      request("/revoke-session", actor.cookie, { token: other.token }),
    );
    expect(response.status).toBe(200);
    expect(await fixtures.session.count({ where: { id: other.id } })).toBe(1);
    expect(await fixtures.session.count({ where: { id: actor.id } })).toBe(1);
  });

  it("user.session-revocation-origin", async () => {
    for (const path of [
      "/revoke-session",
      "/revoke-other-sessions",
      "/revoke-sessions",
    ]) {
      const userId = await user();
      const actor = await session(userId);
      const target = await session(userId);
      const response = await authPostRoute(
        request(
          path,
          actor.cookie,
          { token: target.token },
          "https://untrusted.example",
        ),
      );
      expect(response.status).toBe(403);
      expect(await fixtures.session.count({ where: { userId } })).toBe(2);
    }
  });

  it("user.session-revocation-authoritative", async () => {
    for (const path of [
      "/revoke-session",
      "/revoke-other-sessions",
      "/revoke-sessions",
    ]) {
      const userId = await user();
      const actor = await session(userId);
      const target = await session(userId);
      await fixtures.session.delete({ where: { id: actor.id } });
      const response = await authPostRoute(
        request(path, actor.cookie, { token: target.token }),
      );
      expect(response.status).toBe(401);
      expect(await fixtures.session.count({ where: { id: target.id } })).toBe(
        1,
      );
    }
  });

  it("oauth.authorization-revoke-valid-session", async () => {
    const userId = await user();
    const actor = await session(userId);
    const apiGrant = await grant(userId);
    const webGrant = await grant(userId);
    const response = await authPostRoute(
      request("/oauth2/delete-consent", actor.cookie, { id: apiGrant.id }),
    );
    expect(response.status).toBe(200);
    expect(
      await fixtures.oAuthConsent.findUnique({ where: { id: apiGrant.id } }),
    ).toBeNull();
    await expect(
      settingsRevoke(actor.cookie, webGrant.id),
    ).rejects.toMatchObject({
      status: 303,
      location: "/account/settings/authorizations?message=AuthorizationRevoked",
    });
    expect(
      await fixtures.oAuthConsent.findUnique({ where: { id: webGrant.id } }),
    ).toBeNull();
  });

  it("oauth.authorization-reduction-ownership", async () => {
    const actor = await session(await user());
    const otherGrant = await grant(await user());
    for (const path of ["/oauth2/delete-consent", "/oauth2/update-consent"]) {
      const response = await authPostRoute(
        request(path, actor.cookie, {
          id: otherGrant.id,
          update: { scopes: [] },
        }),
      );
      expect(response.status).toBe(404);
    }
    expect(await settingsRevoke(actor.cookie, otherGrant.id)).toMatchObject({
      status: 404,
    });
    expect(
      await fixtures.oAuthConsent.findUnique({ where: { id: otherGrant.id } }),
    ).toMatchObject({
      grantId: otherGrant.grantId,
      scopes: ["profile", "email"],
    });
  });

  it("oauth.authorization-reduction-origin", async () => {
    const userId = await user();
    const actor = await session(userId);
    const owned = await grant(userId);
    for (const path of ["/oauth2/delete-consent", "/oauth2/update-consent"]) {
      const response = await authPostRoute(
        request(
          path,
          actor.cookie,
          { id: owned.id, update: { scopes: [] } },
          "https://untrusted.example",
        ),
      );
      expect(response.status).toBe(403);
    }
    await expect(
      settingsRevoke(actor.cookie, owned.id, "https://untrusted.example"),
    ).rejects.toMatchObject({ status: 403 });
    expect(
      await fixtures.oAuthConsent.findUnique({ where: { id: owned.id } }),
    ).toMatchObject({ grantId: owned.grantId, scopes: ["profile", "email"] });
  });

  it("oauth.authorization-reduction-authoritative", async () => {
    for (const state of ["revoked", "expired"] as const) {
      for (const path of ["/oauth2/delete-consent", "/oauth2/update-consent"]) {
        const userId = await user();
        const actor = await session(userId);
        const owned = await grant(userId);
        const incoming = request(path, actor.cookie, {
          id: owned.id,
          update: { scopes: [] },
        });
        expect((await getSessionFromHeaders(incoming.headers))?.user.id).toBe(
          userId,
        );
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
          await fixtures.oAuthConsent.findUnique({ where: { id: owned.id } }),
        ).toMatchObject({
          grantId: owned.grantId,
          scopes: ["profile", "email"],
        });
      }
    }
  });

  it("oauth.authorization-reduce-valid-session", async () => {
    const userId = await user();
    const actor = await session(userId);
    const owned = await grant(userId);
    await fixtures.oAuthAccessToken.create({
      data: {
        clientId: owned.clientId,
        grantId: owned.grantId,
        userId,
        token: crypto.randomUUID(),
        scopes: owned.scopes,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const response = await authPostRoute(
      request("/oauth2/update-consent", actor.cookie, {
        id: owned.id,
        update: { scopes: ["profile"] },
      }),
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

  it("oauth.authorization-reduce-no-expansion", async () => {
    for (const minutesOld of [0, 30]) {
      const userId = await user();
      const actor = await session(userId, minutesOld);
      const owned = await grant(userId, ["profile"]);
      const response = await authPostRoute(
        request("/oauth2/update-consent", actor.cookie, {
          id: owned.id,
          update: { scopes: ["profile", "email"] },
        }),
      );
      expect(response.status).toBe(400);
      expect(
        await fixtures.oAuthConsent.findUnique({ where: { id: owned.id } }),
      ).toMatchObject({ grantId: owned.grantId, scopes: ["profile"] });
    }
  });

  it("oauth.authorization-reduce-concurrent", async () => {
    const userId = await user();
    const owned = await grant(userId);
    const results = await Promise.all([
      updateUserOAuthAuthorizationScopes(userId, owned.id, ["profile"]),
      updateUserOAuthAuthorizationScopes(userId, owned.id, ["email"]),
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
