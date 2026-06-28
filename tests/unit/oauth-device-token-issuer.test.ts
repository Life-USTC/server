import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MCP_TOOLS_SCOPE,
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

function createPrismaMock() {
  const deviceCodeDeleteMany = vi.fn().mockResolvedValue({ count: 1 });
  const accessTokenCreate = vi.fn().mockResolvedValue({});
  const refreshTokenCreate = vi.fn().mockResolvedValue({ id: "refresh-1" });
  return {
    prisma: {
      $transaction: vi.fn(async (callback) =>
        callback({
          deviceCode: { deleteMany: deviceCodeDeleteMany },
          oAuthAccessToken: { create: accessTokenCreate },
          oAuthRefreshToken: { create: refreshTokenCreate },
        }),
      ),
    },
    accessTokenCreate,
    deviceCodeDeleteMany,
    refreshTokenCreate,
  };
}

describe("设备令牌签发器", () => {
  beforeEach(() => {
    signJwtMock.mockReset();
  });

  it("使用绑定资源的 JWT 访问令牌且不签发刷新令牌", async () => {
    signJwtMock.mockResolvedValue({ token: "header.payload.signature" });
    const { prisma, accessTokenCreate, refreshTokenCreate } =
      createPrismaMock();
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
    });
    expect(issued).not.toHaveProperty("refreshToken");
    expect(accessTokenCreate).not.toHaveBeenCalled();
    expect(refreshTokenCreate).not.toHaveBeenCalled();
    expect(signJwtMock).toHaveBeenCalledWith({
      body: {
        payload: expect.objectContaining({
          aud: [
            "https://life.example/api/auth",
            "https://life.example/api/mcp",
            "https://life.example/api/auth/oauth2/userinfo",
          ],
          azp: "client-1",
          iss: "https://life.example/api/auth",
          scope: `${OAUTH_OPENID_SCOPE} ${OAUTH_PROFILE_SCOPE} ${MCP_TOOLS_SCOPE} ${OAUTH_OFFLINE_ACCESS_SCOPE}`,
          sub: "user-1",
        }),
      },
    });
  });

  it("无资源访问令牌保持不透明且无 offline_access 时跳过刷新", async () => {
    const { prisma, accessTokenCreate, refreshTokenCreate } =
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
    expect(accessTokenCreate).toHaveBeenCalled();
    expect(refreshTokenCreate).not.toHaveBeenCalled();
    expect(signJwtMock).not.toHaveBeenCalled();
  });

  it("为带 offline_access 的无资源设备授权签发刷新令牌", async () => {
    const { prisma, accessTokenCreate, refreshTokenCreate } =
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
    expect(accessTokenCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ refreshId: "refresh-1" }),
    });
    expect(refreshTokenCreate).toHaveBeenCalled();
    expect(signJwtMock).not.toHaveBeenCalled();
  });
});
