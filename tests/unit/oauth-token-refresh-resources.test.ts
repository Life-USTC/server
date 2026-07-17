import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  OAUTH_AUTHORIZATION_CODE_GRANT_TYPE,
  OAUTH_REFRESH_TOKEN_GRANT_TYPE,
} from "@/lib/oauth/constants";

const findRefreshTokenMock = vi.fn();
const signAccessTokenMock = vi.fn();
const updateRefreshTokenMock = vi.fn();

vi.mock("@/features/oauth/server/device-token-issuer.server", () => ({
  RESOURCE_BOUND_ACCESS_TOKEN_EXPIRES_IN: 300,
  signResourceBoundOAuthAccessToken: signAccessTokenMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    oAuthRefreshToken: {
      findUnique: findRefreshTokenMock,
      updateMany: updateRefreshTokenMock,
    },
  },
}));

vi.mock("@/lib/log/oauth-debug", () => ({
  logOAuthDebug: vi.fn(),
}));

vi.mock("@/lib/oauth/resource-urls", () => ({
  getOAuthProviderValidAudiences: () => [
    "https://life.example/api/auth",
    "https://life.example/api/mcp",
    "https://life.example/api/graphql",
  ],
}));

function base64UrlEncode(input: string) {
  return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unsignedJwt(payload: Record<string, unknown>) {
  return [
    base64UrlEncode(JSON.stringify({ alg: "none", typ: "JWT" })),
    base64UrlEncode(JSON.stringify(payload)),
    "signature",
  ].join(".");
}

describe("OAuth 刷新令牌资源持久化", () => {
  beforeEach(() => {
    vi.resetModules();
    findRefreshTokenMock.mockReset();
    signAccessTokenMock.mockReset();
    updateRefreshTokenMock.mockReset();
    updateRefreshTokenMock.mockResolvedValue({ count: 1 });
  });

  it("拒绝存储批准范围外的资源的刷新请求", async () => {
    findRefreshTokenMock.mockResolvedValue({
      resources: ["https://life.example/api/auth"],
    });
    const { validateOAuthRefreshTokenResources } = await import(
      "@/lib/api/routes/auth-token-refresh-resources"
    );
    const params = new URLSearchParams({
      grant_type: OAUTH_REFRESH_TOKEN_GRANT_TYPE,
      refresh_token: "old-refresh-token",
      resource: "https://life.example/api/mcp",
    });

    const response = await validateOAuthRefreshTokenResources(
      new Request("https://life.example/api/auth/oauth2/token"),
      params,
    );

    expect(response?.status).toBe(400);
    await expect(response?.json()).resolves.toEqual({
      error: "invalid_target",
      error_description:
        "Requested resource is not approved for this refresh token",
    });
  });

  it("允许已存储批准资源的刷新请求", async () => {
    findRefreshTokenMock.mockResolvedValue({
      resources: ["https://life.example/api/mcp"],
    });
    const { validateOAuthRefreshTokenResources } = await import(
      "@/lib/api/routes/auth-token-refresh-resources"
    );
    const params = new URLSearchParams({
      grant_type: OAUTH_REFRESH_TOKEN_GRANT_TYPE,
      refresh_token: "old-refresh-token",
      resource: "https://life.example:443/api/mcp",
    });

    await expect(
      validateOAuthRefreshTokenResources(
        new Request("https://life.example/api/auth/oauth2/token"),
        params,
      ),
    ).resolves.toBeUndefined();
  });

  it("允许刷新令牌请求其已批准的 GraphQL resource", async () => {
    findRefreshTokenMock.mockResolvedValue({
      resources: ["https://life.example/api/graphql"],
    });
    const { validateOAuthRefreshTokenResources } = await import(
      "@/lib/api/routes/auth-token-refresh-resources"
    );
    const params = new URLSearchParams({
      grant_type: OAUTH_REFRESH_TOKEN_GRANT_TYPE,
      refresh_token: "old-refresh-token",
      resource: "https://life.example:443/api/graphql",
    });

    await expect(
      validateOAuthRefreshTokenResources(
        new Request("https://life.example/api/auth/oauth2/token"),
        params,
      ),
    ).resolves.toBeUndefined();
  });

  it("显式 resource 遇到畸形 stored resource 时返回 invalid_target", async () => {
    findRefreshTokenMock.mockResolvedValue({
      resources: ["https://life.example/api/graphql", "not-a-resource-url"],
    });
    const { validateOAuthRefreshTokenResources } = await import(
      "@/lib/api/routes/auth-token-refresh-resources"
    );
    const params = new URLSearchParams({
      grant_type: OAUTH_REFRESH_TOKEN_GRANT_TYPE,
      refresh_token: "old-refresh-token",
      resource: "https://life.example/api/graphql",
    });

    const response = await validateOAuthRefreshTokenResources(
      new Request("https://life.example/api/auth/oauth2/token"),
      params,
    );

    expect(response?.status).toBe(400);
    await expect(response?.json()).resolves.toEqual({
      error: "invalid_target",
      error_description:
        "Requested resource is not approved for this refresh token",
    });
  });

  it("畸形 stored resource 不会签发替换访问令牌", async () => {
    findRefreshTokenMock.mockResolvedValue({
      clientId: "client-1",
      resources: ["https://life.example/api/graphql", "not-a-resource-url"],
      scopes: ["todo:read"],
      userId: "user-1",
    });
    const { replaceOAuthRefreshAccessToken } = await import(
      "@/lib/api/routes/auth-token-refresh-resources"
    );
    const params = new URLSearchParams({
      grant_type: OAUTH_REFRESH_TOKEN_GRANT_TYPE,
      refresh_token: "old-refresh-token",
      resource: "https://life.example/api/graphql",
    });
    const original = Response.json({ access_token: "provider-token" });

    const response = await replaceOAuthRefreshAccessToken(
      new Request("https://life.example/api/auth/oauth2/token"),
      params,
      original,
    );

    await expect(response.json()).resolves.toEqual({
      access_token: "provider-token",
    });
    expect(signAccessTokenMock).not.toHaveBeenCalled();
  });

  it("在授权码刷新令牌上存储已签发的受众资源", async () => {
    const { persistOAuthRefreshTokenResources } = await import(
      "@/lib/api/routes/auth-token-refresh-resources"
    );
    const params = new URLSearchParams({
      grant_type: OAUTH_AUTHORIZATION_CODE_GRANT_TYPE,
      resource: "https://life.example:443/api/mcp",
    });
    const response = Response.json({
      access_token: unsignedJwt({ aud: "https://life.example/api/mcp" }),
      refresh_token: "issued-refresh-token",
    });

    await persistOAuthRefreshTokenResources(
      new Request("https://life.example/api/auth/oauth2/token"),
      params,
      response,
    );

    expect(updateRefreshTokenMock).toHaveBeenCalledWith({
      where: { token: expect.any(String) },
      data: { resources: ["https://life.example/api/mcp"] },
    });
  });

  it("在授权码刷新令牌上存储 GraphQL 受众资源", async () => {
    const { persistOAuthRefreshTokenResources } = await import(
      "@/lib/api/routes/auth-token-refresh-resources"
    );
    const params = new URLSearchParams({
      grant_type: OAUTH_AUTHORIZATION_CODE_GRANT_TYPE,
      resource: "https://life.example:443/api/graphql",
    });
    const response = Response.json({
      access_token: unsignedJwt({ aud: "https://life.example/api/graphql" }),
      refresh_token: "issued-refresh-token",
    });

    await persistOAuthRefreshTokenResources(
      new Request("https://life.example/api/auth/oauth2/token"),
      params,
      response,
    );

    expect(updateRefreshTokenMock).toHaveBeenCalledWith({
      where: { token: expect.any(String) },
      data: { resources: ["https://life.example/api/graphql"] },
    });
  });

  it("不存储已签发访问令牌受众中缺失的请求资源", async () => {
    const { persistOAuthRefreshTokenResources } = await import(
      "@/lib/api/routes/auth-token-refresh-resources"
    );
    const params = new URLSearchParams({
      grant_type: OAUTH_AUTHORIZATION_CODE_GRANT_TYPE,
      resource: "https://life.example/api/mcp",
    });
    const response = Response.json({
      access_token: unsignedJwt({ aud: "https://life.example/api/auth" }),
      refresh_token: "issued-refresh-token",
    });

    await persistOAuthRefreshTokenResources(
      new Request("https://life.example/api/auth/oauth2/token"),
      params,
      response,
    );

    expect(updateRefreshTokenMock).not.toHaveBeenCalled();
  });

  it("刷新授权轮转刷新令牌时复制现有批准资源", async () => {
    findRefreshTokenMock.mockResolvedValue({
      resources: ["https://life.example/api/mcp"],
    });
    const { persistOAuthRefreshTokenResources } = await import(
      "@/lib/api/routes/auth-token-refresh-resources"
    );
    const params = new URLSearchParams({
      grant_type: OAUTH_REFRESH_TOKEN_GRANT_TYPE,
      refresh_token: "old-refresh-token",
    });
    const response = Response.json({ refresh_token: "new-refresh-token" });

    await persistOAuthRefreshTokenResources(
      new Request("https://life.example/api/auth/oauth2/token"),
      params,
      response,
    );

    expect(updateRefreshTokenMock).toHaveBeenCalledWith({
      where: { token: expect.any(String) },
      data: { resources: ["https://life.example/api/mcp"] },
    });
  });
});
