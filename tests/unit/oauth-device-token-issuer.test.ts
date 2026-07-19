import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MCP_TOOLS_SCOPE,
  OAUTH_GRANT_ID_CLAIM,
  OAUTH_OFFLINE_ACCESS_SCOPE,
  OAUTH_OPENID_SCOPE,
  OAUTH_PROFILE_SCOPE,
} from "@/lib/oauth/constants";

const signJwtMock = vi.fn();

vi.mock("@/lib/auth/core", () => ({
  betterAuthInstance: {
    api: {
      signJWT: signJwtMock,
    },
  },
}));

vi.mock("@/lib/mcp/urls", () => ({
  getCanonicalOAuthIssuer: () => "https://life.example/api/auth",
}));

function createPrismaMock(options: { skipConsent?: boolean } = {}) {
  const deviceCodeDeleteMany = vi.fn().mockResolvedValue({ count: 1 });
  const accessTokenDeleteMany = vi.fn().mockResolvedValue({ count: 1 });
  const accessTokenCreate = vi.fn().mockResolvedValue({});
  const clientFindUnique = vi.fn().mockResolvedValue({
    disabled: false,
    skipConsent: options.skipConsent ?? false,
  });
  const consentDeleteMany = vi.fn().mockResolvedValue({ count: 1 });
  const consentUpsert = vi.fn().mockResolvedValue({});
  const refreshTokenDeleteMany = vi.fn().mockResolvedValue({ count: 1 });
  const refreshTokenCreate = vi.fn().mockResolvedValue({ id: "refresh-1" });
  return {
    prisma: {
      $transaction: vi.fn(async (callback) =>
        callback({
          deviceCode: { deleteMany: deviceCodeDeleteMany },
          oAuthAccessToken: {
            create: accessTokenCreate,
            deleteMany: accessTokenDeleteMany,
          },
          oAuthClient: { findUnique: clientFindUnique },
          oAuthConsent: {
            deleteMany: consentDeleteMany,
            upsert: consentUpsert,
          },
          oAuthRefreshToken: {
            create: refreshTokenCreate,
            deleteMany: refreshTokenDeleteMany,
          },
        }),
      ),
    },
    accessTokenDeleteMany,
    accessTokenCreate,
    clientFindUnique,
    consentDeleteMany,
    consentUpsert,
    deviceCodeDeleteMany,
    refreshTokenDeleteMany,
    refreshTokenCreate,
  };
}

describe("设备令牌签发器", () => {
  beforeEach(() => {
    signJwtMock.mockReset();
  });

  it("使用绑定资源的 JWT 访问令牌且为 offline_access 签发刷新令牌", async () => {
    signJwtMock.mockResolvedValue({ token: "header.payload.signature" });
    const {
      prisma,
      accessTokenCreate,
      accessTokenDeleteMany,
      consentUpsert,
      refreshTokenCreate,
      refreshTokenDeleteMany,
    } = createPrismaMock();
    const { issueDeviceGrantTokens } = await import(
      "@/features/oauth/server/device-token-issuer.server"
    );

    const issued = await issueDeviceGrantTokens(prisma, {
      clientId: "client-1",
      deviceCodeRecordId: "device-1",
      resources: [
        "https://life.example/api/auth",
        "https://life.example/api/mcp",
      ],
      scopes: [
        OAUTH_OPENID_SCOPE,
        OAUTH_PROFILE_SCOPE,
        MCP_TOOLS_SCOPE,
        OAUTH_OFFLINE_ACCESS_SCOPE,
      ],
      userId: "user-1",
    });

    expect(issued).toMatchObject({
      accessToken: "header.payload.signature",
      refreshToken: expect.any(String),
    });
    expect(accessTokenCreate).not.toHaveBeenCalled();
    expect(accessTokenDeleteMany).toHaveBeenCalledWith({
      where: { clientId: "client-1", userId: "user-1" },
    });
    expect(refreshTokenDeleteMany).toHaveBeenCalledWith({
      where: { clientId: "client-1", userId: "user-1" },
    });
    expect(consentUpsert).toHaveBeenCalledWith({
      where: {
        clientId_userId: { clientId: "client-1", userId: "user-1" },
      },
      create: {
        clientId: "client-1",
        grantId: expect.any(String),
        scopes: [
          OAUTH_OPENID_SCOPE,
          OAUTH_PROFILE_SCOPE,
          MCP_TOOLS_SCOPE,
          OAUTH_OFFLINE_ACCESS_SCOPE,
        ],
        userId: "user-1",
      },
      update: {
        grantId: expect.any(String),
        scopes: [
          OAUTH_OPENID_SCOPE,
          OAUTH_PROFILE_SCOPE,
          MCP_TOOLS_SCOPE,
          OAUTH_OFFLINE_ACCESS_SCOPE,
        ],
      },
    });
    const grantId = consentUpsert.mock.calls[0]?.[0].create.grantId;
    expect(refreshTokenCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clientId: "client-1",
        grantId,
        referenceId: grantId,
        resources: [
          "https://life.example/api/auth",
          "https://life.example/api/mcp",
        ],
        scopes: [
          OAUTH_OPENID_SCOPE,
          OAUTH_PROFILE_SCOPE,
          MCP_TOOLS_SCOPE,
          OAUTH_OFFLINE_ACCESS_SCOPE,
        ],
        userId: "user-1",
      }),
    });
    expect(signJwtMock).toHaveBeenCalledWith({
      body: {
        payload: expect.objectContaining({
          aud: [
            "https://life.example/api/auth",
            "https://life.example/api/mcp",
            "https://life.example/api/auth/oauth2/userinfo",
          ],
          azp: "client-1",
          [OAUTH_GRANT_ID_CLAIM]: grantId,
          iss: "https://life.example/api/auth",
          scope: `${OAUTH_OPENID_SCOPE} ${OAUTH_PROFILE_SCOPE} ${MCP_TOOLS_SCOPE} ${OAUTH_OFFLINE_ACCESS_SCOPE}`,
          sub: "user-1",
        }),
      },
    });
  });

  it("无资源访问令牌保持不透明且无 offline_access 时跳过刷新", async () => {
    const { prisma, accessTokenCreate, consentUpsert, refreshTokenCreate } =
      createPrismaMock();
    const { issueDeviceGrantTokens } = await import(
      "@/features/oauth/server/device-token-issuer.server"
    );

    const issued = await issueDeviceGrantTokens(prisma, {
      clientId: "client-1",
      deviceCodeRecordId: "device-1",
      resources: [],
      scopes: [OAUTH_OPENID_SCOPE, OAUTH_PROFILE_SCOPE],
      userId: "user-1",
    });

    expect(issued).toEqual({
      accessToken: expect.any(String),
      expiresIn: expect.any(Number),
    });
    if (!issued) {
      throw new Error("Expected device tokens");
    }
    expect(issued.accessToken.split(".").length).toBeLessThan(3);
    const grantId = consentUpsert.mock.calls[0]?.[0].create.grantId;
    expect(accessTokenCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        grantId,
        referenceId: grantId,
      }),
    });
    expect(refreshTokenCreate).not.toHaveBeenCalled();
    expect(signJwtMock).not.toHaveBeenCalled();
  });

  it("为带 offline_access 的无资源设备授权签发刷新令牌", async () => {
    const { prisma, accessTokenCreate, consentUpsert, refreshTokenCreate } =
      createPrismaMock();
    const { issueDeviceGrantTokens } = await import(
      "@/features/oauth/server/device-token-issuer.server"
    );

    const issued = await issueDeviceGrantTokens(prisma, {
      clientId: "client-1",
      deviceCodeRecordId: "device-1",
      resources: [],
      scopes: [
        OAUTH_OPENID_SCOPE,
        OAUTH_PROFILE_SCOPE,
        OAUTH_OFFLINE_ACCESS_SCOPE,
      ],
      userId: "user-1",
    });

    expect(issued).toEqual({
      accessToken: expect.any(String),
      expiresIn: expect.any(Number),
      refreshToken: expect.any(String),
    });
    const grantId = consentUpsert.mock.calls[0]?.[0].create.grantId;
    expect(accessTokenCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        grantId,
        referenceId: grantId,
        refreshId: "refresh-1",
      }),
    });
    expect(refreshTokenCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        grantId,
        referenceId: grantId,
      }),
    });
    expect(signJwtMock).not.toHaveBeenCalled();
  });

  it("trusted client 设备流清理普通 consent 但保留 token lineage", async () => {
    const { prisma, accessTokenCreate, consentDeleteMany, consentUpsert } =
      createPrismaMock({ skipConsent: true });
    const { issueDeviceGrantTokens } = await import(
      "@/features/oauth/server/device-token-issuer.server"
    );

    const issued = await issueDeviceGrantTokens(prisma, {
      clientId: "trusted-client",
      deviceCodeRecordId: "device-1",
      resources: [],
      scopes: [OAUTH_PROFILE_SCOPE],
      userId: "user-1",
    });

    expect(issued).toBeTruthy();
    expect(consentDeleteMany).toHaveBeenCalledWith({
      where: { clientId: "trusted-client", userId: "user-1" },
    });
    expect(consentUpsert).not.toHaveBeenCalled();
    expect(accessTokenCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clientId: "trusted-client",
        grantId: expect.any(String),
        referenceId: expect.any(String),
      }),
    });
  });
});
