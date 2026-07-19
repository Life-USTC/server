import { afterAll, describe, expect, it, vi } from "vitest";
import { bindOAuthAuthorizationCodeRedirectToActiveGrant } from "@/features/oauth/server/oauth-authorization-code-grant.server";
import { createAcceptedOAuthAuthorization } from "@/features/oauth/server/oauth-consent-action";
import { prisma } from "@/lib/db/prisma";
import { hashOAuthClientSecretForDbStorage } from "@/lib/oauth/utils";

describe.sequential("OAuth consent transaction", () => {
  const marker = crypto.randomUUID();
  const clientIds: string[] = [];
  const userIds: string[] = [];
  const verificationIdentifiers: string[] = [];

  async function createFixture(label: string, skipConsent = false) {
    const user = await prisma.user.create({
      data: {
        email: `oauth-consent-${label}-${marker}@example.test`,
        name: `OAuth consent ${label}`,
      },
      select: { id: true },
    });
    const clientId = `oauth-consent-${label}-${marker}`;
    await prisma.oAuthClient.create({
      data: {
        clientId,
        name: `OAuth consent ${label}`,
        redirectUris: ["https://client.example/callback"],
        scopes: ["openid", "profile"],
        skipConsent,
      },
    });
    const consent = await prisma.oAuthConsent.create({
      data: {
        clientId,
        scopes: ["profile"],
        userId: user.id,
      },
      select: { grantId: true, id: true },
    });
    const refresh = await prisma.oAuthRefreshToken.create({
      data: {
        clientId,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        grantId: consent.grantId,
        referenceId: consent.grantId,
        scopes: ["profile"],
        token: `refresh-${label}-${marker}`,
        userId: user.id,
      },
      select: { id: true },
    });
    await Promise.all([
      prisma.oAuthAccessToken.create({
        data: {
          clientId,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
          grantId: consent.grantId,
          referenceId: consent.grantId,
          refreshId: refresh.id,
          scopes: ["profile"],
          token: `access-${label}-${marker}`,
          userId: user.id,
        },
      }),
      prisma.deviceCode.create({
        data: {
          clientId,
          deviceCode: `device-${label}-${marker}`,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
          scopes: ["profile"],
          status: "approved",
          userCode: `user-code-${label}-${marker}`,
          userId: user.id,
        },
      }),
    ]);
    clientIds.push(clientId);
    userIds.push(user.id);
    return { clientId, consent, userId: user.id };
  }

  function authorizeQuery(clientId: string) {
    return new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: "https://client.example/callback",
      scope: "openid profile",
      state: `state-${marker}`,
      prompt: "consent",
      code_challenge: "integration-code-challenge",
      code_challenge_method: "S256",
    });
  }

  function session(userId: string) {
    return {
      session: {
        createdAt: new Date("2026-07-20T00:00:00.000Z"),
        id: `session-${marker}`,
      },
      user: { id: userId },
    };
  }

  async function expectFixtureUnchanged(input: {
    clientId: string;
    grantId: string;
    userId: string;
  }) {
    const [consent, accessTokens, refreshTokens, deviceCodes] =
      await Promise.all([
        prisma.oAuthConsent.findUniqueOrThrow({
          where: {
            clientId_userId: {
              clientId: input.clientId,
              userId: input.userId,
            },
          },
          select: { grantId: true, scopes: true },
        }),
        prisma.oAuthAccessToken.count({
          where: { clientId: input.clientId, userId: input.userId },
        }),
        prisma.oAuthRefreshToken.count({
          where: { clientId: input.clientId, userId: input.userId },
        }),
        prisma.deviceCode.count({
          where: { clientId: input.clientId, userId: input.userId },
        }),
      ]);
    expect({
      accessTokens,
      consent,
      deviceCodes,
      refreshTokens,
    }).toEqual({
      accessTokens: 1,
      consent: { grantId: input.grantId, scopes: ["profile"] },
      deviceCodes: 1,
      refreshTokens: 1,
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

  it("原子轮换 consent、清理旧凭据并创建 exact-bound code", async () => {
    const fixture = await createFixture("success");
    const query = authorizeQuery(fixture.clientId);
    query.append("resource", "https://life.example/api/graphql");
    query.append("resource", "https://life.example/api/mcp");
    const authorization = await createAcceptedOAuthAuthorization({
      acceptedScopes: ["openid", "profile"],
      authorizeQuery: query,
      session: session(fixture.userId),
    });
    expect(authorization).not.toBeNull();
    if (!authorization) throw new Error("Expected authorization");

    const callback = new URL(authorization.redirectTarget);
    const code = callback.searchParams.get("code");
    expect(code).toBeTruthy();
    if (!code) throw new Error("Expected authorization code");
    const identifier = await hashOAuthClientSecretForDbStorage(code);
    verificationIdentifiers.push(identifier);
    const [consent, codeRow, counts] = await Promise.all([
      prisma.oAuthConsent.findUniqueOrThrow({
        where: {
          clientId_userId: {
            clientId: fixture.clientId,
            userId: fixture.userId,
          },
        },
        select: { grantId: true, scopes: true },
      }),
      prisma.verificationToken.findFirstOrThrow({
        where: { identifier },
        select: { token: true },
      }),
      Promise.all([
        prisma.oAuthAccessToken.count({
          where: { clientId: fixture.clientId, userId: fixture.userId },
        }),
        prisma.oAuthRefreshToken.count({
          where: { clientId: fixture.clientId, userId: fixture.userId },
        }),
        prisma.deviceCode.count({
          where: { clientId: fixture.clientId, userId: fixture.userId },
        }),
      ]),
    ]);

    expect(consent.grantId).not.toBe(fixture.consent.grantId);
    expect(consent.scopes).toEqual(["openid", "profile"]);
    expect(counts).toEqual([0, 0, 0]);
    expect(JSON.parse(codeRow.token)).toMatchObject({
      query: {
        resource: [
          "https://life.example/api/graphql",
          "https://life.example/api/mcp",
        ],
      },
      referenceId: consent.grantId,
      type: "authorization_code",
    });
    await expect(
      bindOAuthAuthorizationCodeRedirectToActiveGrant(
        authorization.redirectTarget,
        fixture.clientId,
        "https://life.example/oauth/authorize",
        consent.grantId,
      ),
    ).resolves.toBe(true);
  });

  it("grantId rotation 冲突时回滚 consent 与旧凭据清理", async () => {
    const fixture = await createFixture("rotation-rollback");
    const collision = await createFixture("rotation-collision");
    const randomUuid = vi
      .spyOn(crypto, "randomUUID")
      .mockReturnValue(
        collision.consent
          .grantId as `${string}-${string}-${string}-${string}-${string}`,
      );

    try {
      await expect(
        createAcceptedOAuthAuthorization({
          acceptedScopes: ["openid", "profile"],
          authorizeQuery: authorizeQuery(fixture.clientId),
          session: session(fixture.userId),
        }),
      ).rejects.toMatchObject({ code: "P2002" });
    } finally {
      randomUuid.mockRestore();
    }
    await expectFixtureUnchanged({
      clientId: fixture.clientId,
      grantId: fixture.consent.grantId,
      userId: fixture.userId,
    });
  });

  it("authorization code 写入失败时回滚已完成的 rotation 与 cleanup", async () => {
    const fixture = await createFixture("code-rollback");
    const fixedGrantId = "11111111-1111-4111-8111-111111111111";
    const fixedNow = Date.parse("2026-07-20T01:00:00.000Z");
    const code = "a".repeat(32);
    const identifier = await hashOAuthClientSecretForDbStorage(code);
    verificationIdentifiers.push(identifier);
    const query = authorizeQuery(fixture.clientId);
    query.set("scope", "openid profile");
    query.delete("prompt");
    const token = JSON.stringify({
      type: "authorization_code",
      query: Object.fromEntries(query.entries()),
      userId: fixture.userId,
      sessionId: `session-${marker}`,
      referenceId: fixedGrantId,
      authTime: Date.parse("2026-07-20T00:00:00.000Z"),
    });
    await prisma.verificationToken.create({
      data: {
        identifier,
        token,
        expires: new Date(fixedNow + 10 * 60 * 1000),
      },
    });

    const randomUuid = vi
      .spyOn(crypto, "randomUUID")
      .mockReturnValue(fixedGrantId);
    const randomValues = vi
      .spyOn(crypto, "getRandomValues")
      .mockImplementation(((array: Uint8Array) => {
        array.fill(0);
        return array;
      }) as typeof crypto.getRandomValues);
    const now = vi.spyOn(Date, "now").mockReturnValue(fixedNow);

    try {
      await expect(
        createAcceptedOAuthAuthorization({
          acceptedScopes: ["openid", "profile"],
          authorizeQuery: authorizeQuery(fixture.clientId),
          session: session(fixture.userId),
        }),
      ).rejects.toMatchObject({ code: "P2002" });
    } finally {
      randomUuid.mockRestore();
      randomValues.mockRestore();
      now.mockRestore();
    }
    await expectFixtureUnchanged({
      clientId: fixture.clientId,
      grantId: fixture.consent.grantId,
      userId: fixture.userId,
    });
  });

  it("trusted client 不创建 consent 且保留旧 generation 证据", async () => {
    const fixture = await createFixture("trusted", true);
    const authorization = await createAcceptedOAuthAuthorization({
      acceptedScopes: ["openid", "profile"],
      authorizeQuery: authorizeQuery(fixture.clientId),
      session: session(fixture.userId),
    });
    expect(authorization).not.toBeNull();
    if (!authorization) throw new Error("Expected trusted authorization");

    const code = new URL(authorization.redirectTarget).searchParams.get("code");
    if (!code) throw new Error("Expected authorization code");
    const identifier = await hashOAuthClientSecretForDbStorage(code);
    verificationIdentifiers.push(identifier);
    const codeRow = await prisma.verificationToken.findFirstOrThrow({
      where: { identifier },
      select: { token: true },
    });

    const [consentCount, accessCount, refreshCount, deviceCount] =
      await Promise.all([
        prisma.oAuthConsent.count({
          where: { clientId: fixture.clientId, userId: fixture.userId },
        }),
        prisma.oAuthAccessToken.count({
          where: { clientId: fixture.clientId, userId: fixture.userId },
        }),
        prisma.oAuthRefreshToken.count({
          where: { clientId: fixture.clientId, userId: fixture.userId },
        }),
        prisma.deviceCode.count({
          where: { clientId: fixture.clientId, userId: fixture.userId },
        }),
      ]);
    expect([consentCount, accessCount, refreshCount, deviceCount]).toEqual([
      0, 1, 1, 1,
    ]);
    const stored = JSON.parse(codeRow.token);
    expect(stored.referenceId).toBe(authorization.expectedGrantId);
    await expect(
      bindOAuthAuthorizationCodeRedirectToActiveGrant(
        authorization.redirectTarget,
        fixture.clientId,
        "https://life.example/oauth/authorize",
        authorization.expectedGrantId,
      ),
    ).resolves.toBe(true);
  });
});
