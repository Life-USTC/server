import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { issueDeviceGrantTokens } from "@/features/oauth/server/device-token-issuer.server";
import {
  listUserOAuthAuthorizations,
  resolveActiveOAuthRefreshGrant,
  revokeUserOAuthAuthorization,
  updateUserOAuthAuthorizationScopes,
} from "@/features/oauth/server/user-authorizations.server";
import { prisma } from "@/lib/db/prisma";
import { hasActiveOAuthUserGrant } from "@/lib/oauth/active-user-grant";
import { hashOAuthClientSecretForDbStorage } from "@/lib/oauth/utils";

describe.sequential("OAuth user authorization management", () => {
  const marker = crypto.randomUUID();
  const clientId = `oauth-authorization-${marker}`;
  const trustedClientId = `oauth-trusted-${marker}`;
  const refreshToken = `refresh-${marker}`;
  let latestGrantId = "";
  let latestConsentId = "";
  let otherUserConsentId = "";
  let userId = "";
  let otherUserId = "";

  beforeAll(async () => {
    const [user, otherUser] = await Promise.all([
      prisma.user.create({
        data: {
          email: `oauth-authorization-${marker}@example.test`,
          name: "OAuth authorization user",
        },
        select: { id: true },
      }),
      prisma.user.create({
        data: {
          email: `oauth-authorization-other-${marker}@example.test`,
          name: "Other OAuth authorization user",
        },
        select: { id: true },
      }),
    ]);
    userId = user.id;
    otherUserId = otherUser.id;

    await prisma.oAuthClient.createMany({
      data: [
        {
          clientId,
          clientSecret: "must-not-be-returned",
          name: "Integration Calendar",
          redirectUris: ["https://calendar.example/callback"],
          scopes: ["calendar:read", "profile"],
          uri: "https://calendar.example",
        },
        {
          clientId: trustedClientId,
          name: "Trusted first-party client",
          redirectUris: ["https://life.example/callback"],
          skipConsent: true,
        },
      ],
    });

    const [latestConsent, otherConsent] = await Promise.all([
      prisma.oAuthConsent.create({
        data: {
          clientId,
          scopes: ["calendar:read", "profile"],
          updatedAt: new Date("2026-07-20T00:00:00.000Z"),
          userId,
        },
        select: { grantId: true, id: true },
      }),
      prisma.oAuthConsent.create({
        data: {
          clientId,
          scopes: ["profile"],
          userId: otherUserId,
        },
        select: { id: true },
      }),
    ]);
    latestConsentId = latestConsent.id;
    latestGrantId = latestConsent.grantId;
    otherUserConsentId = otherConsent.id;

    const refresh = await prisma.oAuthRefreshToken.create({
      data: {
        clientId,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        grantId: latestGrantId,
        referenceId: latestGrantId,
        scopes: ["calendar:read", "profile"],
        token: await hashOAuthClientSecretForDbStorage(refreshToken),
        userId,
      },
      select: { id: true },
    });
    await Promise.all([
      prisma.oAuthAccessToken.create({
        data: {
          clientId,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
          grantId: latestGrantId,
          referenceId: latestGrantId,
          refreshId: refresh.id,
          scopes: ["calendar:read", "profile"],
          token: `access-${marker}`,
          userId,
        },
      }),
      prisma.deviceCode.create({
        data: {
          clientId,
          deviceCode: `device-${marker}`,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
          scopes: ["calendar:read", "profile"],
          status: "approved",
          userCode: `user-${marker}`,
          userId,
        },
      }),
      prisma.oAuthAccessToken.create({
        data: {
          clientId,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
          scopes: ["profile"],
          token: `other-access-${marker}`,
          userId: otherUserId,
        },
      }),
      prisma.oAuthRefreshToken.create({
        data: {
          clientId,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          scopes: ["profile"],
          token: `other-refresh-${marker}`,
          userId: otherUserId,
        },
      }),
      prisma.deviceCode.create({
        data: {
          clientId,
          deviceCode: `other-device-${marker}`,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
          scopes: ["profile"],
          status: "approved",
          userCode: `other-user-${marker}`,
          userId: otherUserId,
        },
      }),
    ]);
  });

  afterAll(async () => {
    await prisma.oAuthClient.deleteMany({
      where: { clientId: { in: [clientId, trustedClientId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [userId, otherUserId] } },
    });
    await prisma.$disconnect();
  });

  it("lists one safe, grouped row per authorized client", async () => {
    await expect(listUserOAuthAuthorizations(userId)).resolves.toEqual([
      {
        clientName: "Integration Calendar",
        clientUri: "https://calendar.example",
        consentId: latestConsentId,
        disabled: false,
        scopes: ["calendar:read", "profile"],
        updatedAt: "2026-07-20T00:00:00.000Z",
      },
    ]);
  });

  it("accepts consent-backed and explicitly trusted grants only", async () => {
    await expect(hasActiveOAuthUserGrant({ clientId, userId })).resolves.toBe(
      true,
    );
    await expect(
      hasActiveOAuthUserGrant({
        clientId,
        grantId: latestGrantId,
        requireGrantBinding: true,
        scopes: ["calendar:read", "profile"],
        userId,
      }),
    ).resolves.toBe(true);
    await expect(
      hasActiveOAuthUserGrant({ clientId: trustedClientId, userId }),
    ).resolves.toBe(true);
    await expect(
      hasActiveOAuthUserGrant({
        clientId: trustedClientId,
        userId: "missing-user",
      }),
    ).resolves.toBe(false);
    await expect(resolveActiveOAuthRefreshGrant(refreshToken)).resolves.toEqual(
      {
        clientId,
        grantId: latestGrantId,
        scopes: ["calendar:read", "profile"],
        userId,
      },
    );

    await prisma.oAuthClient.update({
      where: { clientId },
      data: { disabled: true },
    });
    await expect(hasActiveOAuthUserGrant({ clientId, userId })).resolves.toBe(
      false,
    );
    await prisma.oAuthClient.update({
      where: { clientId },
      data: { disabled: false },
    });
  });

  it("does not reveal or revoke another user's consent", async () => {
    await expect(
      revokeUserOAuthAuthorization(userId, otherUserConsentId),
    ).resolves.toEqual({ ok: false, reason: "not_found" });

    await expect(
      prisma.oAuthConsent.count({
        where: { clientId, userId: otherUserId },
      }),
    ).resolves.toBe(1);
  });

  it("atomically removes this user's grant material without touching another user", async () => {
    await expect(
      revokeUserOAuthAuthorization(userId, latestConsentId),
    ).resolves.toEqual({
      ok: true,
      deleted: {
        accessTokens: 1,
        consents: 1,
        deviceCodes: 1,
        refreshTokens: 1,
      },
    });

    const [
      userAccessTokens,
      userConsents,
      userDeviceCodes,
      userRefreshTokens,
      otherAccessTokens,
      otherConsents,
      otherDeviceCodes,
      otherRefreshTokens,
    ] = await Promise.all([
      prisma.oAuthAccessToken.count({ where: { clientId, userId } }),
      prisma.oAuthConsent.count({ where: { clientId, userId } }),
      prisma.deviceCode.count({ where: { clientId, userId } }),
      prisma.oAuthRefreshToken.count({ where: { clientId, userId } }),
      prisma.oAuthAccessToken.count({
        where: { clientId, userId: otherUserId },
      }),
      prisma.oAuthConsent.count({
        where: { clientId, userId: otherUserId },
      }),
      prisma.deviceCode.count({ where: { clientId, userId: otherUserId } }),
      prisma.oAuthRefreshToken.count({
        where: { clientId, userId: otherUserId },
      }),
    ]);

    expect({
      otherAccessTokens,
      otherConsents,
      otherDeviceCodes,
      otherRefreshTokens,
      userAccessTokens,
      userConsents,
      userDeviceCodes,
      userRefreshTokens,
    }).toEqual({
      otherAccessTokens: 1,
      otherConsents: 1,
      otherDeviceCodes: 1,
      otherRefreshTokens: 1,
      userAccessTokens: 0,
      userConsents: 0,
      userDeviceCodes: 0,
      userRefreshTokens: 0,
    });
    await expect(hasActiveOAuthUserGrant({ clientId, userId })).resolves.toBe(
      false,
    );
    await expect(resolveActiveOAuthRefreshGrant(refreshToken)).resolves.toBe(
      null,
    );

    const replacement = await prisma.oAuthConsent.create({
      data: {
        clientId,
        scopes: ["profile"],
        userId,
      },
      select: { grantId: true, id: true },
    });
    await expect(
      hasActiveOAuthUserGrant({
        clientId,
        grantId: latestGrantId,
        requireGrantBinding: true,
        scopes: ["profile"],
        userId,
      }),
    ).resolves.toBe(false);
    await expect(
      hasActiveOAuthUserGrant({
        clientId,
        grantId: replacement.grantId,
        requireGrantBinding: true,
        scopes: ["profile"],
        userId,
      }),
    ).resolves.toBe(true);

    const replacementRefresh = await prisma.oAuthRefreshToken.create({
      data: {
        clientId,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        grantId: replacement.grantId,
        referenceId: replacement.grantId,
        scopes: ["profile"],
        token: `replacement-refresh-${marker}`,
        userId,
      },
      select: { id: true },
    });
    await Promise.all([
      prisma.oAuthAccessToken.create({
        data: {
          clientId,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
          grantId: replacement.grantId,
          referenceId: replacement.grantId,
          refreshId: replacementRefresh.id,
          scopes: ["profile"],
          token: `replacement-access-${marker}`,
          userId,
        },
      }),
      prisma.deviceCode.create({
        data: {
          clientId,
          deviceCode: `replacement-device-${marker}`,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
          scopes: ["profile"],
          status: "approved",
          userCode: `replacement-user-${marker}`,
          userId,
        },
      }),
    ]);
    const reduced = await updateUserOAuthAuthorizationScopes(
      userId,
      replacement.id,
      [],
    );
    expect(reduced).toMatchObject({
      consentId: replacement.id,
      ok: true,
      scopes: [],
    });
    if (!reduced.ok) throw new Error("Expected scope reduction to succeed");
    expect(reduced.grantId).not.toBe(replacement.grantId);
    await expect(
      hasActiveOAuthUserGrant({
        clientId,
        grantId: replacement.grantId,
        requireGrantBinding: true,
        userId,
      }),
    ).resolves.toBe(false);
    await expect(
      Promise.all([
        prisma.oAuthAccessToken.count({ where: { clientId, userId } }),
        prisma.oAuthRefreshToken.count({ where: { clientId, userId } }),
        prisma.deviceCode.count({ where: { clientId, userId } }),
      ]),
    ).resolves.toEqual([0, 0, 0]);
  });

  it("serializes concurrent device grants into one current generation", async () => {
    const devices = await Promise.all(
      [1, 2].map((index) =>
        prisma.deviceCode.create({
          data: {
            clientId,
            deviceCode: `concurrent-device-${index}-${marker}`,
            expiresAt: new Date(Date.now() + 5 * 60 * 1000),
            scopes: ["profile"],
            status: "approved",
            userCode: `concurrent-user-${index}-${marker}`,
            userId,
          },
          select: { id: true },
        }),
      ),
    );

    const issued = await Promise.all(
      devices.map((device) =>
        issueDeviceGrantTokens(prisma, {
          clientId,
          deviceCodeRecordId: device.id,
          resources: [],
          scopes: ["profile"],
          userId,
        }),
      ),
    );
    expect(issued.every(Boolean)).toBe(true);
    const accessTokens = issued.flatMap((result) =>
      result ? [result.accessToken] : [],
    );
    const hashes = await Promise.all(
      accessTokens.map(hashOAuthClientSecretForDbStorage),
    );
    const [consent, tokenRows] = await Promise.all([
      prisma.oAuthConsent.findUniqueOrThrow({
        where: { clientId_userId: { clientId, userId } },
        select: { grantId: true },
      }),
      prisma.oAuthAccessToken.findMany({
        where: { clientId, token: { in: hashes }, userId },
        select: { grantId: true, referenceId: true },
      }),
    ]);

    expect(tokenRows).toEqual([
      {
        grantId: consent.grantId,
        referenceId: consent.grantId,
      },
    ]);
    await expect(
      prisma.oAuthConsent.count({ where: { clientId, userId } }),
    ).resolves.toBe(1);
  });
});
