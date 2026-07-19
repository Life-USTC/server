import { afterAll, describe, expect, it } from "vitest";
import { bindOAuthAuthorizationCodeToActiveGrant } from "@/features/oauth/server/oauth-authorization-code-grant.server";
import { createAcceptedOAuthAuthorization } from "@/features/oauth/server/oauth-consent-action";
import { persistRefreshTokenResources } from "@/features/oauth/server/refresh-token-resources.server";
import {
  isOAuthRefreshGrantActive,
  purgeOAuthGrantTokenRows,
  purgeRevokedOAuthRefreshTokenLineage,
  resolveActiveOAuthRefreshGrant,
} from "@/features/oauth/server/user-authorizations.server";
import { prisma } from "@/lib/db/prisma";
import { hasActiveOAuthUserGrant } from "@/lib/oauth/active-user-grant";
import {
  OAUTH_REFRESH_REPLAY_TOMBSTONE_SCOPE,
  OAUTH_REFRESH_TOKEN_EXPIRES_IN_SECONDS,
  OAUTH_REFRESH_TOKEN_GRANT_TYPE,
} from "@/lib/oauth/constants";
import {
  getOAuthGraphqlResourceUrl,
  getOAuthMcpResourceUrl,
} from "@/lib/oauth/resource-urls";
import { hashOAuthClientSecretForDbStorage } from "@/lib/oauth/utils";

describe.sequential("OAuth refresh lineage cleanup", () => {
  const marker = crypto.randomUUID();
  const clientIds: string[] = [];
  const userIds: string[] = [];
  const verificationIdentifiers: string[] = [];

  async function createIdentity(label: string, skipConsent = false) {
    const user = await prisma.user.create({
      data: {
        email: `oauth-lineage-${label}-${marker}@example.test`,
        name: `OAuth lineage ${label}`,
      },
      select: { id: true },
    });
    const clientId = `oauth-lineage-${label}-${marker}`;
    await prisma.oAuthClient.create({
      data: {
        clientId,
        redirectUris: ["https://client.example/callback"],
        scopes: ["profile"],
        skipConsent,
      },
    });
    clientIds.push(clientId);
    userIds.push(user.id);
    return { clientId, userId: user.id };
  }

  async function createRefresh(input: {
    clientId: string;
    expiresAt?: Date;
    grantId?: string;
    rawToken: string;
    resources?: string[];
    revoked?: Date;
    userId: string;
  }) {
    return prisma.oAuthRefreshToken.create({
      data: {
        clientId: input.clientId,
        expiresAt: input.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000),
        grantId: input.grantId,
        referenceId: input.grantId,
        resources: input.resources,
        revoked: input.revoked,
        scopes: ["profile"],
        token: await hashOAuthClientSecretForDbStorage(input.rawToken),
        userId: input.userId,
      },
      select: { id: true },
    });
  }

  async function createAccess(input: {
    clientId: string;
    grantId?: string;
    refreshId: string;
    token: string;
    userId: string;
  }) {
    await prisma.oAuthAccessToken.create({
      data: {
        clientId: input.clientId,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        grantId: input.grantId,
        referenceId: input.grantId,
        refreshId: input.refreshId,
        scopes: ["profile"],
        token: input.token,
        userId: input.userId,
      },
    });
  }

  afterAll(async () => {
    await prisma.verificationToken.deleteMany({
      where: { identifier: { in: verificationIdentifiers } },
    });
    await prisma.oAuthClient.deleteMany({
      where: { clientId: { in: clientIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it("null-grant cleanup 不会误删并发产生的 exact-grant rows", async () => {
    const identity = await createIdentity("null", true);
    const legacyRefresh = await createRefresh({
      ...identity,
      rawToken: `legacy-null-${marker}`,
    });
    await createAccess({
      ...identity,
      refreshId: legacyRefresh.id,
      token: `legacy-null-access-${marker}`,
    });
    const exactGrantId = crypto.randomUUID();
    const exactRefresh = await createRefresh({
      ...identity,
      grantId: exactGrantId,
      rawToken: `exact-${marker}`,
    });
    await createAccess({
      ...identity,
      grantId: exactGrantId,
      refreshId: exactRefresh.id,
      token: `exact-access-${marker}`,
    });

    await purgeOAuthGrantTokenRows({
      ...identity,
      scopes: ["profile"],
    });

    await expect(
      Promise.all([
        prisma.oAuthRefreshToken.count({
          where: { ...identity, grantId: null, referenceId: null },
        }),
        prisma.oAuthAccessToken.count({
          where: { ...identity, grantId: null, referenceId: null },
        }),
        prisma.oAuthRefreshToken.count({
          where: { ...identity, grantId: exactGrantId },
        }),
        prisma.oAuthAccessToken.count({
          where: { ...identity, grantId: exactGrantId },
        }),
      ]),
    ).resolves.toEqual([0, 0, 1, 1]);
  });

  it("旧 revoked lineage 重放不影响重新授权的新 generation", async () => {
    const identity = await createIdentity("reauthorized");
    const oldGrantId = crypto.randomUUID();
    const oldRawToken = `old-revoked-${marker}`;
    const oldRefresh = await createRefresh({
      ...identity,
      grantId: oldGrantId,
      rawToken: oldRawToken,
      revoked: new Date(),
    });
    await createAccess({
      ...identity,
      grantId: oldGrantId,
      refreshId: oldRefresh.id,
      token: `old-revoked-access-${marker}`,
    });
    const consent = await prisma.oAuthConsent.create({
      data: {
        ...identity,
        scopes: ["profile"],
      },
      select: { grantId: true },
    });
    const currentRefresh = await createRefresh({
      ...identity,
      grantId: consent.grantId,
      rawToken: `current-${marker}`,
    });
    await createAccess({
      ...identity,
      grantId: consent.grantId,
      refreshId: currentRefresh.id,
      token: `current-access-${marker}`,
    });

    await expect(
      purgeRevokedOAuthRefreshTokenLineage(oldRawToken),
    ).resolves.toBe(true);

    await expect(
      Promise.all([
        prisma.oAuthRefreshToken.count({
          where: { ...identity, grantId: oldGrantId },
        }),
        prisma.oAuthAccessToken.count({
          where: { ...identity, grantId: oldGrantId },
        }),
        prisma.oAuthRefreshToken.count({
          where: { ...identity, grantId: consent.grantId },
        }),
        prisma.oAuthAccessToken.count({
          where: { ...identity, grantId: consent.grantId },
        }),
      ]),
    ).resolves.toEqual([1, 0, 1, 1]);
  });

  it("正常 rotation 的 revoked history 不会被误判为 replay tombstone", async () => {
    const identity = await createIdentity("normal-rotation");
    const consent = await prisma.oAuthConsent.create({
      data: { ...identity, scopes: ["profile"] },
      select: { grantId: true },
    });
    await createRefresh({
      ...identity,
      grantId: consent.grantId,
      rawToken: `normal-rotation-old-${marker}`,
      revoked: new Date(),
    });
    const activeRawToken = `normal-rotation-active-${marker}`;
    await createRefresh({
      ...identity,
      grantId: consent.grantId,
      rawToken: activeRawToken,
    });
    const grant = {
      ...identity,
      grantId: consent.grantId,
      scopes: ["profile"],
    };

    await expect(isOAuthRefreshGrantActive(grant)).resolves.toBe(true);
    await expect(
      resolveActiveOAuthRefreshGrant(activeRawToken),
    ).resolves.toEqual(grant);
  });

  it("trusted null lineage 的正常 rotation history 不会阻断授权", async () => {
    const identity = await createIdentity("trusted-normal-rotation", true);
    await createRefresh({
      ...identity,
      rawToken: `trusted-normal-rotation-old-${marker}`,
      revoked: new Date(),
    });
    const activeRawToken = `trusted-normal-rotation-active-${marker}`;
    await createRefresh({
      ...identity,
      rawToken: activeRawToken,
    });

    await expect(
      hasActiveOAuthUserGrant({
        ...identity,
        requireGrantBinding: true,
        scopes: ["profile"],
      }),
    ).resolves.toBe(true);
    await expect(
      resolveActiveOAuthRefreshGrant(activeRawToken),
    ).resolves.toEqual({ ...identity, scopes: ["profile"] });
  });

  it("当前 generation 的 refresh 重放保留 tombstone 并轮换 consent", async () => {
    const identity = await createIdentity("current-family");
    const consent = await prisma.oAuthConsent.create({
      data: {
        ...identity,
        scopes: ["profile"],
      },
      select: { grantId: true },
    });
    const revokedRawToken = `current-revoked-${marker}`;
    const revoked = await createRefresh({
      ...identity,
      grantId: consent.grantId,
      rawToken: revokedRawToken,
      revoked: new Date(),
    });
    const active = await createRefresh({
      ...identity,
      grantId: consent.grantId,
      rawToken: `current-active-${marker}`,
    });
    await Promise.all([
      createAccess({
        ...identity,
        grantId: consent.grantId,
        refreshId: revoked.id,
        token: `current-revoked-access-${marker}`,
      }),
      createAccess({
        ...identity,
        grantId: consent.grantId,
        refreshId: active.id,
        token: `current-active-access-${marker}`,
      }),
    ]);

    await expect(
      purgeRevokedOAuthRefreshTokenLineage(revokedRawToken),
    ).resolves.toBe(true);
    const [refreshCount, accessCount, rotatedConsent] = await Promise.all([
      prisma.oAuthRefreshToken.count({
        where: { ...identity, grantId: consent.grantId },
      }),
      prisma.oAuthAccessToken.count({
        where: { ...identity, grantId: consent.grantId },
      }),
      prisma.oAuthConsent.findUniqueOrThrow({
        where: { clientId_userId: identity },
        select: { grantId: true },
      }),
    ]);
    expect([refreshCount, accessCount]).toEqual([1, 0]);
    expect(rotatedConsent.grantId).not.toBe(consent.grantId);
  });

  it("CAS→cleanup→create 时 tombstone 阻止 exact lineage 复活", async () => {
    const identity = await createIdentity("resurrection-exact");
    const consent = await prisma.oAuthConsent.create({
      data: { ...identity, scopes: ["profile"] },
      select: { grantId: true },
    });
    const oldRawToken = `resurrection-exact-old-${marker}`;
    await createRefresh({
      ...identity,
      grantId: consent.grantId,
      rawToken: oldRawToken,
    });
    await prisma.oAuthRefreshToken.update({
      where: {
        token: await hashOAuthClientSecretForDbStorage(oldRawToken),
      },
      data: { revoked: new Date() },
    });

    await purgeRevokedOAuthRefreshTokenLineage(oldRawToken);
    const resurrectedRawToken = `resurrection-exact-new-${marker}`;
    const resurrected = await createRefresh({
      ...identity,
      grantId: consent.grantId,
      rawToken: resurrectedRawToken,
    });
    await createAccess({
      ...identity,
      grantId: consent.grantId,
      refreshId: resurrected.id,
      token: `resurrection-exact-access-${marker}`,
    });

    const grant = {
      ...identity,
      grantId: consent.grantId,
      scopes: ["profile"],
    };
    await expect(isOAuthRefreshGrantActive(grant)).resolves.toBe(false);
    await expect(
      resolveActiveOAuthRefreshGrant(resurrectedRawToken),
    ).resolves.toBeNull();
    await purgeOAuthGrantTokenRows(grant);
    await expect(
      Promise.all([
        prisma.oAuthRefreshToken.count({
          where: { ...identity, grantId: consent.grantId, revoked: null },
        }),
        prisma.oAuthRefreshToken.count({
          where: {
            ...identity,
            grantId: consent.grantId,
            revoked: { not: null },
          },
        }),
        prisma.oAuthAccessToken.count({
          where: { ...identity, grantId: consent.grantId },
        }),
      ]),
    ).resolves.toEqual([0, 1, 0]);
  });

  it("CAS→cleanup→create 时 tombstone 也阻止 trusted null lineage 复活", async () => {
    const identity = await createIdentity("resurrection-null", true);
    const oldRawToken = `resurrection-null-old-${marker}`;
    await createRefresh({ ...identity, rawToken: oldRawToken });
    await prisma.oAuthRefreshToken.update({
      where: {
        token: await hashOAuthClientSecretForDbStorage(oldRawToken),
      },
      data: { revoked: new Date() },
    });

    const replayDetectedAt = Date.now();
    await purgeRevokedOAuthRefreshTokenLineage(oldRawToken);
    const tombstone = await prisma.oAuthRefreshToken.findUniqueOrThrow({
      where: {
        token: await hashOAuthClientSecretForDbStorage(oldRawToken),
      },
      select: { expiresAt: true, scopes: true },
    });
    expect(tombstone.scopes).toContain(OAUTH_REFRESH_REPLAY_TOMBSTONE_SCOPE);
    expect(tombstone.expiresAt.getTime()).toBeGreaterThanOrEqual(
      replayDetectedAt + OAUTH_REFRESH_TOKEN_EXPIRES_IN_SECONDS * 1000,
    );

    const accepted = await createAcceptedOAuthAuthorization({
      acceptedScopes: ["profile"],
      authorizeQuery: new URLSearchParams({
        response_type: "code",
        client_id: identity.clientId,
        redirect_uri: "https://client.example/callback",
        scope: "profile",
        prompt: "consent",
        code_challenge: "trusted-recovery-challenge",
        code_challenge_method: "S256",
      }),
      session: {
        session: { id: `trusted-recovery-session-${marker}` },
        user: { id: identity.userId },
      },
    });
    expect(accepted).not.toBeNull();
    if (!accepted) throw new Error("Expected trusted recovery authorization");
    const acceptedCode = new URL(accepted.redirectTarget).searchParams.get(
      "code",
    );
    if (!acceptedCode) throw new Error("Expected trusted recovery code");
    verificationIdentifiers.push(
      await hashOAuthClientSecretForDbStorage(acceptedCode),
    );
    await expect(
      hasActiveOAuthUserGrant({
        ...identity,
        grantId: accepted.expectedGrantId,
        requireGrantBinding: true,
        scopes: ["profile"],
      }),
    ).resolves.toBe(true);

    const resurrectedRawToken = `resurrection-null-new-${marker}`;
    const resurrected = await createRefresh({
      ...identity,
      expiresAt: new Date(
        replayDetectedAt + OAUTH_REFRESH_TOKEN_EXPIRES_IN_SECONDS * 1000 - 1,
      ),
      rawToken: resurrectedRawToken,
    });
    await createAccess({
      ...identity,
      refreshId: resurrected.id,
      token: `resurrection-null-access-${marker}`,
    });

    const grant = { ...identity, scopes: ["profile"] };
    await expect(
      hasActiveOAuthUserGrant({
        ...identity,
        requireGrantBinding: true,
        scopes: ["profile"],
      }),
    ).resolves.toBe(false);
    await expect(isOAuthRefreshGrantActive(grant)).resolves.toBe(false);
    await expect(
      resolveActiveOAuthRefreshGrant(resurrectedRawToken),
    ).resolves.toBeNull();
    await purgeOAuthGrantTokenRows(grant);
    await expect(
      Promise.all([
        prisma.oAuthRefreshToken.count({
          where: {
            ...identity,
            grantId: null,
            referenceId: null,
            revoked: null,
          },
        }),
        prisma.oAuthRefreshToken.count({
          where: {
            ...identity,
            grantId: null,
            referenceId: null,
            revoked: { not: null },
            scopes: { has: OAUTH_REFRESH_REPLAY_TOMBSTONE_SCOPE },
          },
        }),
        prisma.oAuthAccessToken.count({
          where: { ...identity, grantId: null, referenceId: null },
        }),
      ]),
    ).resolves.toEqual([0, 1, 0]);

    const recoveryCode = `trusted-recovery-${marker}`;
    const recoveryIdentifier =
      await hashOAuthClientSecretForDbStorage(recoveryCode);
    verificationIdentifiers.push(recoveryIdentifier);
    await prisma.verificationToken.create({
      data: {
        expires: new Date(Date.now() + 5 * 60 * 1000),
        identifier: recoveryIdentifier,
        token: JSON.stringify({
          query: {
            client_id: identity.clientId,
            scope: "profile",
          },
          type: "authorization_code",
          userId: identity.userId,
        }),
      },
    });
    await expect(
      bindOAuthAuthorizationCodeToActiveGrant(recoveryCode, identity.clientId),
    ).resolves.toBe(true);
    const recoveredCode = await prisma.verificationToken.findFirstOrThrow({
      where: { identifier: recoveryIdentifier },
      select: { token: true },
    });
    const recoveredGrantId = JSON.parse(recoveredCode.token).referenceId;
    expect(recoveredGrantId).toEqual(expect.any(String));
    await expect(
      hasActiveOAuthUserGrant({
        ...identity,
        grantId: recoveredGrantId,
        requireGrantBinding: true,
        scopes: ["profile"],
      }),
    ).resolves.toBe(true);
  });

  it("数据库中的 rotated refresh 仅在显式 resource 时收窄", async () => {
    const identity = await createIdentity("resource-downscope");
    const graphql = getOAuthGraphqlResourceUrl();
    const mcp = getOAuthMcpResourceUrl();
    const oldRawToken = `resource-old-${marker}`;
    await createRefresh({
      ...identity,
      rawToken: oldRawToken,
      resources: [graphql, mcp],
    });
    const narrowedRawToken = `resource-narrowed-${marker}`;
    const inheritedRawToken = `resource-inherited-${marker}`;
    await Promise.all([
      createRefresh({
        ...identity,
        rawToken: narrowedRawToken,
      }),
      createRefresh({
        ...identity,
        rawToken: inheritedRawToken,
      }),
    ]);

    await expect(
      persistRefreshTokenResources({
        grantType: OAUTH_REFRESH_TOKEN_GRANT_TYPE,
        issuedRefreshToken: narrowedRawToken,
        refreshToken: oldRawToken,
        resourceValues: [graphql],
      }),
    ).resolves.toMatchObject({ persisted: true, resourceCount: 1 });
    await expect(
      persistRefreshTokenResources({
        grantType: OAUTH_REFRESH_TOKEN_GRANT_TYPE,
        issuedRefreshToken: inheritedRawToken,
        refreshToken: oldRawToken,
        resourceValues: [],
      }),
    ).resolves.toMatchObject({ persisted: true, resourceCount: 2 });

    const [narrowedHash, inheritedHash] = await Promise.all(
      [narrowedRawToken, inheritedRawToken].map(
        hashOAuthClientSecretForDbStorage,
      ),
    );
    const rows = await prisma.oAuthRefreshToken.findMany({
      where: {
        token: { in: [narrowedHash, inheritedHash] },
      },
      orderBy: { token: "asc" },
      select: { token: true, resources: true },
    });
    const byToken = new Map(rows.map((row) => [row.token, row.resources]));
    expect(byToken.get(narrowedHash)).toEqual([graphql]);
    expect(byToken.get(inheritedHash)).toEqual([graphql, mcp]);
  });

  it("真实 Better Auth adapter 不再对 revoked token 执行跨 generation family 删除", async () => {
    const identity = await createIdentity("provider-reuse");
    await prisma.oAuthClient.update({
      where: { clientId: identity.clientId },
      data: { public: true },
    });
    const oldGrantId = crypto.randomUUID();
    const oldRawToken = `provider-old-${marker}`;
    await createRefresh({
      ...identity,
      grantId: oldGrantId,
      rawToken: oldRawToken,
      revoked: new Date(),
    });
    const consent = await prisma.oAuthConsent.create({
      data: { ...identity, scopes: ["profile"] },
      select: { grantId: true },
    });
    await createRefresh({
      ...identity,
      grantId: consent.grantId,
      rawToken: `provider-current-${marker}`,
    });

    const { getBetterAuthInstance } = await import("@/lib/auth/core");
    const response = await getBetterAuthInstance().handler(
      new Request("http://localhost:3000/api/auth/oauth2/token", {
        body: new URLSearchParams({
          client_id: identity.clientId,
          grant_type: OAUTH_REFRESH_TOKEN_GRANT_TYPE,
          refresh_token: oldRawToken,
        }),
        headers: {
          "content-type": "application/x-www-form-urlencoded",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    await expect(
      Promise.all([
        prisma.oAuthRefreshToken.count({
          where: { ...identity, grantId: oldGrantId },
        }),
        prisma.oAuthRefreshToken.count({
          where: { ...identity, grantId: consent.grantId },
        }),
      ]),
    ).resolves.toEqual([1, 1]);
  });
});
