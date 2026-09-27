import { afterAll, afterEach, beforeEach, expect, it } from "vitest";
import { createAcceptedOAuthAuthorization } from "@/features/oauth/server/oauth-consent-action";
import {
  revokeUserOAuthAuthorization,
  updateUserOAuthAuthorizationScopes,
} from "@/features/oauth/server/user-authorizations.server";
import { listOwnAccountSecurityActivity } from "@/features/settings/server/account-activity";
import { logAppEvent } from "@/lib/log/app-logger";
import { hashOAuthClientSecretForDbStorage } from "@/lib/oauth/utils";
import { createFixturePrisma } from "../shared/prisma";

const db = createFixturePrisma();
let userId: string;
let clientId: string;
const privateState = "private-oauth-state";
const privateRedirect = "https://private-client.example/callback";
const scopes = ["openid", "profile", "workspace.todo:read"];
beforeEach(async () => {
  userId = `audit-user-${crypto.randomUUID()}`;
  clientId = `audit-client-${crypto.randomUUID()}`;
  await db.user.create({
    data: { id: userId, email: `${userId}@example.test` },
  });
  await db.oAuthClient.create({
    data: {
      clientId,
      name: "Private client name",
      public: true,
      requirePKCE: true,
      tokenEndpointAuthMethod: "none",
      redirectUris: [privateRedirect],
      scopes,
    },
  });
});
afterEach(async () => {
  await db.verificationToken.deleteMany({
    where: { token: { contains: userId } },
  });
  await db.auditLog.deleteMany({ where: { userId } });
  await db.oAuthClient.delete({ where: { clientId } });
  await db.user.delete({ where: { id: userId } });
});
afterAll(() => db.$disconnect());
function authorize(requestId = "audit-request") {
  return createAcceptedOAuthAuthorization({
    acceptedScopes: scopes,
    authorizeQuery: new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: privateRedirect,
      scope: scopes.join(" "),
      state: privateState,
      code_challenge: "private-proof-challenge",
      code_challenge_method: "S256",
      resource: "http://localhost:3000/api/mcp",
    }),
    session: {
      user: { id: userId },
      session: { id: "audit-session", createdAt: new Date() },
    },
    audit: { requestId, channel: "auth" },
  });
}
async function events(
  action:
    | "oauth_authorization_grant"
    | "oauth_authorization_update"
    | "oauth_authorization_revoke",
) {
  return db.auditLog.findMany({ where: { userId, action } });
}
function privateValuesAbsent(value: unknown, secrets: string[] = []) {
  const serialized = JSON.stringify(value);
  for (const secret of [
    privateState,
    privateRedirect,
    "private-proof-challenge",
    "Private client name",
    ...secrets,
  ])
    expect(serialized).not.toContain(secret);
}
async function granted() {
  const result = await authorize();
  if (!result) throw new Error("Expected authorization");
  return db.oAuthConsent.findUniqueOrThrow({
    where: { clientId_userId: { clientId, userId } },
  });
}
async function tokenRows(grantId: string) {
  const refresh = await db.oAuthRefreshToken.create({
    data: {
      clientId,
      userId,
      grantId,
      referenceId: grantId,
      token: "private-refresh",
      scopes,
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  await db.oAuthAccessToken.create({
    data: {
      clientId,
      userId,
      grantId,
      referenceId: grantId,
      refreshId: refresh.id,
      token: "private-access",
      scopes,
      expiresAt: new Date(Date.now() + 300000),
    },
  });
  await db.deviceCode.create({
    data: {
      clientId,
      userId,
      deviceCode: "private-device",
      userCode: "PRIVATE-CODE",
      scopes,
      status: "approved",
      expiresAt: new Date(Date.now() + 300000),
    },
  });
}
async function state() {
  return {
    consents: await db.oAuthConsent.findMany({ where: { clientId, userId } }),
    codes: await db.verificationToken.findMany({
      where: { token: { contains: userId } },
    }),
    access: await db.oAuthAccessToken.findMany({ where: { clientId, userId } }),
    refresh: await db.oAuthRefreshToken.findMany({
      where: { clientId, userId },
    }),
    device: await db.deviceCode.findMany({ where: { clientId, userId } }),
    audit: await db.auditLog.findMany({ where: { userId } }),
  };
}

it("audit.action-oauth-authorization-grant", async () => {
  const before = await state();
  await expect(authorize("invalid\u0000audit-request")).rejects.toThrow();
  expect(await state()).toEqual(before);
  const result = await authorize();
  if (!result) throw new Error("Expected authorization");
  const code = new URL(result.redirectTarget).searchParams.get("code");
  if (!code) throw new Error("Expected authorization code");
  const consent = await db.oAuthConsent.findUniqueOrThrow({
    where: { clientId_userId: { clientId, userId } },
  });
  const verification = await db.verificationToken.findFirstOrThrow({
    where: { identifier: await hashOAuthClientSecretForDbStorage(code) },
  });
  expect(JSON.parse(verification.token)).toMatchObject({
    referenceId: consent.grantId,
    userId,
    type: "authorization_code",
  });
  const audit = await events("oauth_authorization_grant");
  expect(audit).toHaveLength(1);
  expect(audit[0]).toMatchObject({
    userId,
    subjectUserId: userId,
    oauthClientId: clientId,
    oauthGrantId: consent.grantId,
    targetId: clientId,
    targetType: "oauth_client",
    channel: "auth",
    outcome: "success",
    metadata: {
      changedFields: ["resources", "scopes", "userinfoClaims"],
      resourceCount: 1,
      scopeCount: 3,
    },
  });
  privateValuesAbsent(audit, [code, verification.token]);
});

it("audit.action-oauth-authorization-update", async () => {
  const consent = await granted();
  await tokenRows(consent.grantId);
  const before = await state();
  await expect(
    updateUserOAuthAuthorizationScopes(userId, consent.id, ["openid"], {
      requestId: "invalid\u0000audit-request",
    }),
  ).rejects.toThrow();
  expect(await state()).toEqual(before);
  const result = await updateUserOAuthAuthorizationScopes(
    userId,
    consent.id,
    ["openid"],
    { channel: "web", requestId: "update-request" },
  );
  expect(result).toMatchObject({
    ok: true,
    consentId: consent.id,
    scopes: ["openid"],
  });
  const changed = await db.oAuthConsent.findUniqueOrThrow({
    where: { id: consent.id },
  });
  expect(changed.grantId).not.toBe(consent.grantId);
  expect(changed.scopes).toEqual(["openid"]);
  const audit = await events("oauth_authorization_update");
  expect(audit).toHaveLength(1);
  expect(audit[0]).toMatchObject({
    userId,
    subjectUserId: userId,
    oauthClientId: clientId,
    oauthGrantId: changed.grantId,
    targetId: consent.id,
    targetType: "oauth_consent",
    metadata: { changedFields: ["scopes"], scopeCount: 1 },
  });
  privateValuesAbsent(audit, [
    "private-refresh",
    "private-access",
    "private-device",
    "PRIVATE-CODE",
  ]);
});

it("audit.action-oauth-authorization-revoke", async () => {
  const consent = await granted();
  await tokenRows(consent.grantId);
  const before = await state();
  await expect(
    revokeUserOAuthAuthorization(userId, consent.id, {
      requestId: "invalid\u0000audit-request",
    }),
  ).rejects.toThrow();
  expect(await state()).toEqual(before);
  expect(
    await revokeUserOAuthAuthorization(userId, consent.id, { channel: "web" }),
  ).toEqual({
    ok: true,
    deleted: { accessTokens: 1, refreshTokens: 1, deviceCodes: 1, consents: 1 },
  });
  const after = await state();
  expect([after.consents, after.access, after.refresh, after.device]).toEqual([
    [],
    [],
    [],
    [],
  ]);
  const audit = await events("oauth_authorization_revoke");
  expect(audit).toHaveLength(1);
  expect(audit[0]).toMatchObject({
    userId,
    subjectUserId: userId,
    oauthClientId: clientId,
    oauthGrantId: consent.grantId,
    targetId: consent.id,
    targetType: "oauth_consent",
    metadata: {
      revokedAccessTokenCount: 1,
      revokedDeviceCodeCount: 1,
      revokedRefreshTokenCount: 1,
    },
  });
  privateValuesAbsent(audit, [
    "private-refresh",
    "private-access",
    "private-device",
    "PRIVATE-CODE",
  ]);
  expect(await revokeUserOAuthAuthorization(userId, consent.id)).toEqual({
    ok: false,
    reason: "not_found",
  });
  expect(await events("oauth_authorization_revoke")).toEqual(audit);
});

it("audit.writer-1", async () => {
  const consent = await granted();
  const rows = await events("oauth_authorization_grant");
  expect(rows).toHaveLength(1);
  const projected = await listOwnAccountSecurityActivity(userId);
  expect(
    projected.some(
      (row) =>
        row.id === rows[0].id && row.action === "oauth_authorization_grant",
    ),
  ).toBe(true);
  const row = await db.auditLog.findUniqueOrThrow({
    where: { id: rows[0].id },
  });
  expect(row).toMatchObject({
    oauthGrantId: consent.grantId,
    metadata: {
      scopeCount: 3,
      resourceCount: 1,
      changedFields: ["resources", "scopes", "userinfoClaims"],
    },
  });
  logAppEvent("info", "audit-contract.operational-only", {
    event: "audit-contract.operational-only",
    source: "integration",
  });
  expect(await events("oauth_authorization_grant")).toEqual(rows);
  expect(await db.auditLog.count({ where: { userId } })).toBe(1);
  expect(projected[0]).not.toHaveProperty("metadata");
});
