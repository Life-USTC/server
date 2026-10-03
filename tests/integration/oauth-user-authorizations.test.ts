import { describe, expect } from "vitest";
import { issueDeviceGrantTokens } from "@/features/oauth/server/device-token-issuer.server";
import {
  listUserOAuthAuthorizations,
  resolveActiveOAuthRefreshGrant,
  revokeUserOAuthAuthorization,
  rotateOAuthUserGrantAfterConsent,
  updateUserOAuthAuthorizationScopes,
} from "@/features/oauth/server/user-authorizations.server";
import { authPrisma } from "@/lib/db/auth-prisma";
import { hasActiveOAuthUserGrant } from "@/lib/oauth/active-user-grant";
import { hashOAuthClientSecretForDbStorage } from "@/lib/oauth/utils";
import { isolatedNodeTest } from "../shared/isolated-node-fixture";
import type { TestPrismaClient } from "../shared/prisma";

function prepareAuthorizations(owner: TestPrismaClient) {
  return owner.$transaction(async (prisma) => {
    const marker = "authorization";
    const clientId = `oauth-authorization-${marker}`;
    const trustedClientId = `oauth-trusted-${marker}`;
    const refreshToken = `refresh-${marker}`;
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
    const userId = user.id;
    const otherUserId = otherUser.id;

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

    const [latestConsent, otherConsent, trustedConsent] = await Promise.all([
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
      prisma.oAuthConsent.create({
        data: {
          clientId: trustedClientId,
          scopes: ["profile"],
          userId,
        },
        select: { id: true },
      }),
    ]);
    const latestConsentId = latestConsent.id;
    const latestGrantId = latestConsent.grantId;
    const otherUserConsentId = otherConsent.id;
    const trustedConsentId = trustedConsent.id;

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
    return {
      marker,
      clientId,
      trustedClientId,
      refreshToken,
      latestGrantId,
      latestConsentId,
      otherUserConsentId,
      trustedConsentId,
      userId,
      otherUserId,
    };
  });
}
const test = isolatedNodeTest.extend<{
  authorization: Awaited<ReturnType<typeof prepareAuthorizations>>;
}>({
  authorization: async ({ isolatedDatabase, nodeRuntime }, use) => {
    const state = await nodeRuntime.run(() =>
      prepareAuthorizations(isolatedDatabase.owner),
    );
    await use(state);
  },
});

describe("OAuth user authorization management", () => {
  test("lists one safe, grouped row per authorized client", async ({
    authorization,
    nodeRuntime,
  }) =>
    nodeRuntime.run(async () => {
      const { latestConsentId, userId } = authorization;
      await expect(listUserOAuthAuthorizations(userId)).resolves.toEqual([
        {
          clientName: "Integration Calendar",
          clientUri: "https://calendar.example",
          consentId: latestConsentId,
          disabled: false,
          scopes: ["calendar:read", "profile"],
          updatedAt: "2026-07-20T00:00:00.000Z",
          usage: null,
        },
      ]);
    }));

  test("accepts consent-backed and explicitly trusted grants only", async ({
    authorization,
    isolatedDatabase: { owner: prisma },
    nodeRuntime,
  }) =>
    nodeRuntime.run(async () => {
      const { clientId, trustedClientId, refreshToken, latestGrantId, userId } =
        authorization;
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
      await expect(
        resolveActiveOAuthRefreshGrant(refreshToken),
      ).resolves.toEqual({
        clientId,
        grantId: latestGrantId,
        scopes: ["calendar:read", "profile"],
        userId,
      });

      await prisma.oAuthClient.update({
        where: { clientId },
        data: { disabled: true },
      });
      await expect(hasActiveOAuthUserGrant({ clientId, userId })).resolves.toBe(
        false,
      );
    }));

  test("does not reveal or revoke another user's consent", async ({
    authorization,
    isolatedDatabase: { owner: prisma },
    nodeRuntime,
  }) =>
    nodeRuntime.run(async () => {
      const { clientId, otherUserConsentId, userId, otherUserId } =
        authorization;
      await expect(
        revokeUserOAuthAuthorization(userId, otherUserConsentId),
      ).resolves.toEqual({ ok: false, reason: "not_found" });

      await expect(
        prisma.oAuthConsent.count({
          where: { clientId, userId: otherUserId },
        }),
      ).resolves.toBe(1);
    }));

  test("does not list or revoke trusted-client consent artifacts", async ({
    authorization,
    isolatedDatabase: { owner: prisma },
    nodeRuntime,
  }) =>
    nodeRuntime.run(async () => {
      const { trustedClientId, trustedConsentId, userId } = authorization;
      await expect(
        revokeUserOAuthAuthorization(userId, trustedConsentId),
      ).resolves.toEqual({ ok: false, reason: "not_found" });
      await expect(
        prisma.oAuthConsent.count({
          where: { clientId: trustedClientId, userId },
        }),
      ).resolves.toBe(1);
    }));

  test("cleans trusted prompt-consent artifacts and fails old tokens closed after trust is removed", async ({
    authorization,
    isolatedDatabase: { owner: prisma },
    nodeRuntime,
  }) =>
    nodeRuntime.run(async () => {
      const { marker, trustedClientId, userId } = authorization;
      await expect(
        rotateOAuthUserGrantAfterConsent({
          clientId: trustedClientId,
          scopes: ["profile"],
          userId,
        }),
      ).resolves.toEqual({ kind: "trusted" });
      await expect(
        prisma.oAuthConsent.count({
          where: { clientId: trustedClientId, userId },
        }),
      ).resolves.toBe(0);

      const device = await prisma.deviceCode.create({
        data: {
          clientId: trustedClientId,
          deviceCode: `trusted-device-${marker}`,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
          scopes: ["profile"],
          status: "approved",
          userCode: `trusted-user-${marker}`,
          userId,
        },
        select: { id: true },
      });
      const issued = await issueDeviceGrantTokens(authPrisma, {
        clientId: trustedClientId,
        deviceCodeRecordId: device.id,
        resources: [],
        scopes: ["profile"],
        userId,
      });
      if (!issued) throw new Error("Expected trusted device token");
      const token = await prisma.oAuthAccessToken.findUniqueOrThrow({
        where: {
          token: await hashOAuthClientSecretForDbStorage(issued.accessToken),
        },
        select: { grantId: true, scopes: true },
      });
      await expect(
        prisma.oAuthConsent.count({
          where: { clientId: trustedClientId, userId },
        }),
      ).resolves.toBe(0);

      await prisma.oAuthClient.update({
        where: { clientId: trustedClientId },
        data: { skipConsent: false },
      });
      await expect(
        hasActiveOAuthUserGrant({
          clientId: trustedClientId,
          grantId: token.grantId ?? undefined,
          requireGrantBinding: true,
          scopes: token.scopes,
          userId,
        }),
      ).resolves.toBe(false);
    }));

  test("atomically removes this user's grant material without touching another user", async ({
    authorization,
    isolatedDatabase: { owner: prisma },
    nodeRuntime,
  }) =>
    nodeRuntime.run(async () => {
      const {
        marker,
        clientId,
        refreshToken,
        latestGrantId,
        latestConsentId,
        userId,
        otherUserId,
      } = authorization;
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
      const revokeAudit = await prisma.auditLog.findFirstOrThrow({
        where: {
          action: "oauth_authorization_revoke",
          oauthClientId: clientId,
        },
        orderBy: { createdAt: "desc" },
        select: { metadata: true, oauthGrantId: true, targetId: true },
      });
      expect(revokeAudit).toMatchObject({
        oauthGrantId: latestGrantId,
        targetId: latestConsentId,
      });
      expect(JSON.stringify(revokeAudit)).not.toContain(refreshToken);

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
        prisma.auditLog.findFirst({
          where: {
            action: "oauth_authorization_update",
            oauthGrantId: reduced.grantId,
          },
          select: { metadata: true },
        }),
      ).resolves.toEqual({
        metadata: { changedFields: ["scopes"], scopeCount: 0 },
      });
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
    }));

  test("serializes concurrent device grants into one current generation", async ({
    authorization,
    isolatedDatabase: { owner: prisma },
    nodeRuntime,
  }) =>
    nodeRuntime.run(async () => {
      const { marker, clientId, userId } = authorization;
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
          issueDeviceGrantTokens(authPrisma, {
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
    }));
});
