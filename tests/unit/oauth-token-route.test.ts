import { beforeEach, describe, expect, it, vi } from "vitest";
import { tokenGetRoute, tokenPostRoute } from "@/lib/api/routes/auth-token";
import {
  OAUTH_OFFLINE_ACCESS_SCOPE,
  OAUTH_OPENID_SCOPE,
  OAUTH_PROFILE_SCOPE,
  OAUTH_REFRESH_TOKEN_GRANT_TYPE,
} from "@/lib/oauth/constants";

const {
  betterAuthHandlerMock,
  findRefreshTokenMock,
  signJwtMock,
  updateRefreshTokenMock,
} = vi.hoisted(() => ({
  betterAuthHandlerMock: vi.fn(),
  findRefreshTokenMock: vi.fn(),
  signJwtMock: vi.fn(),
  updateRefreshTokenMock: vi.fn(),
}));

vi.mock("@/lib/auth/core", () => ({
  betterAuthInstance: {
    api: {
      signJWT: signJwtMock,
    },
    handler: betterAuthHandlerMock,
  },
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    oAuthRefreshToken: {
      findUnique: findRefreshTokenMock,
      updateMany: updateRefreshTokenMock,
    },
  },
}));

vi.mock("@/lib/mcp/urls", () => ({
  getCanonicalOAuthIssuer: () => "https://life.example/api/auth",
  getOAuthMcpResourceUrl: () => "https://life.example/api/mcp",
}));

vi.mock("@/lib/oauth/resource-urls", () => ({
  getOAuthGraphqlResourceUrl: () => "https://life.example/api/graphql",
  getOAuthMcpResourceUrl: () => "https://life.example/api/mcp",
  getOAuthProviderValidAudiences: () => [
    "https://life.example/api/auth",
    "https://life.example/api/mcp",
    "https://life.example/api/graphql",
  ],
}));

describe("OAuth 令牌路由", () => {
  beforeEach(() => {
    betterAuthHandlerMock.mockReset();
    findRefreshTokenMock.mockReset();
    signJwtMock.mockReset();
    updateRefreshTokenMock.mockReset();
    updateRefreshTokenMock.mockResolvedValue({ count: 1 });
  });

  it("为 GET 返回 JSON 方法指引", async () => {
    const response = await tokenGetRoute(
      new Request("http://localhost/api/auth/oauth2/token"),
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
    expect(await response.json()).toEqual({
      error: "invalid_request",
      error_description: "Use POST to exchange OAuth grants.",
    });
    expect(betterAuthHandlerMock).not.toHaveBeenCalled();
  });

  it("规范化委托的 Better Auth 验证错误", async () => {
    betterAuthHandlerMock.mockResolvedValueOnce(
      Response.json(
        {
          message: "[body.grant_type] Invalid option",
          code: "VALIDATION_ERROR",
        },
        { status: 400 },
      ),
    );

    const response = await tokenPostRoute(
      new Request("http://localhost/api/auth/oauth2/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "grant_type=unsupported",
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "invalid_request",
      error_description: "[body.grant_type] Invalid option",
    });
  });

  it("保留委托的 OAuth 错误头", async () => {
    betterAuthHandlerMock.mockResolvedValueOnce(
      Response.json(
        {
          message: "Invalid client credentials",
        },
        {
          status: 401,
          headers: {
            "Cache-Control": "no-store",
            "Content-Length": "999",
            "WWW-Authenticate": 'Basic realm="OAuth token"',
          },
        },
      ),
    );

    const response = await tokenPostRoute(
      new Request("http://localhost/api/auth/oauth2/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "grant_type=client_credentials",
      }),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-length")).toBeNull();
    expect(response.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    expect(response.headers.get("www-authenticate")).toBe(
      'Basic realm="OAuth token"',
    );
    expect(await response.json()).toEqual({
      error: "invalid_client",
      error_description: "Invalid client credentials",
    });
  });

  it("在委托前拒绝未批准的刷新令牌资源", async () => {
    findRefreshTokenMock.mockResolvedValueOnce({
      resources: ["https://life.example/api/auth"],
    });

    const response = await tokenPostRoute(
      new Request("http://localhost/api/auth/oauth2/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: "old-refresh-token",
          resource: "https://life.example/api/mcp",
        }).toString(),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "invalid_target",
      error_description:
        "Requested resource is not approved for this refresh token",
    });
    expect(betterAuthHandlerMock).not.toHaveBeenCalled();
  });

  it("刷新已绑定资源的令牌时返回覆盖批准资源的 JWT access token", async () => {
    findRefreshTokenMock.mockResolvedValue({
      clientId: "client-1",
      resources: [
        "https://life.example/api/auth",
        "https://life.example/api/mcp",
      ],
      scopes: [
        OAUTH_OPENID_SCOPE,
        OAUTH_PROFILE_SCOPE,
        OAUTH_OFFLINE_ACCESS_SCOPE,
      ],
      userId: "user-1",
    });
    betterAuthHandlerMock.mockResolvedValueOnce(
      Response.json({
        access_token: "better-auth-access-token",
        expires_in: 3600,
        refresh_token: "new-refresh-token",
        token_type: "Bearer",
      }),
    );
    signJwtMock.mockResolvedValueOnce({ token: "signed-refresh-access-token" });
    const body = new URLSearchParams({
      client_id: "client-1",
      grant_type: OAUTH_REFRESH_TOKEN_GRANT_TYPE,
      refresh_token: "old-refresh-token",
    });
    body.append("resource", "https://life.example/api/auth");
    body.append("resource", "https://life.example/api/mcp");

    const response = await tokenPostRoute(
      new Request("http://localhost/api/auth/oauth2/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      access_token: "signed-refresh-access-token",
      refresh_token: "new-refresh-token",
      token_type: "Bearer",
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
          iss: "https://life.example/api/auth",
          scope: `${OAUTH_OPENID_SCOPE} ${OAUTH_PROFILE_SCOPE} ${OAUTH_OFFLINE_ACCESS_SCOPE}`,
          sub: "user-1",
        }),
      },
    });
  });
});
