import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MCP_TOOLS_SCOPE,
  mcpScope,
  OAUTH_PROFILE_SCOPE,
  OAUTH_REFRESH_TOKEN_GRANT_TYPE,
  restReadScope,
} from "@/lib/oauth/constants";

const findRefreshTokenMock = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    oAuthRefreshToken: {
      findUnique: findRefreshTokenMock,
    },
  },
}));

vi.mock("@/lib/log/oauth-debug", () => ({
  logOAuthDebug: vi.fn(),
}));

vi.mock("@/lib/oauth/resource-urls", () => ({
  getOAuthGraphqlResourceUrl: () => "https://life.example/api/graphql",
  getOAuthMcpResourceUrl: () => "https://life.example/api/mcp",
}));

function refreshRequest(params: URLSearchParams) {
  return new Request("https://life.example/api/auth/oauth2/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
}

describe("OAuth 刷新资源绑定", () => {
  beforeEach(() => {
    vi.resetModules();
    findRefreshTokenMock.mockReset();
  });

  it("不将无资源的 mcp:tools 刷新授权绑定到 MCP 资源", async () => {
    findRefreshTokenMock.mockResolvedValue({
      resources: [],
      scopes: [MCP_TOOLS_SCOPE],
    });
    const { maybeBindOAuthRefreshResourceRequest } = await import(
      "@/lib/api/routes/auth-token-refresh-resource-binding"
    );
    const params = new URLSearchParams({
      grant_type: OAUTH_REFRESH_TOKEN_GRANT_TYPE,
      refresh_token: "refresh-token",
    });
    const request = refreshRequest(params);

    const result = await maybeBindOAuthRefreshResourceRequest(request, params);

    expect(result).toBe(request);
    expect(params.has("resource")).toBe(false);
  });

  it("不将非 MCP 批准的刷新授权绑定到 MCP 资源", async () => {
    findRefreshTokenMock.mockResolvedValue({
      resources: ["https://life.example/api/auth"],
      scopes: [MCP_TOOLS_SCOPE],
    });
    const { maybeBindOAuthRefreshResourceRequest } = await import(
      "@/lib/api/routes/auth-token-refresh-resource-binding"
    );
    const params = new URLSearchParams({
      grant_type: OAUTH_REFRESH_TOKEN_GRANT_TYPE,
      refresh_token: "refresh-token",
    });
    const request = refreshRequest(params);

    const result = await maybeBindOAuthRefreshResourceRequest(request, params);

    expect(result).toBe(request);
    expect(params.has("resource")).toBe(false);
  });

  it("仅在存储授权包含 MCP 资源时绑定省略资源的刷新", async () => {
    findRefreshTokenMock.mockResolvedValue({
      resources: ["https://life.example/api/mcp"],
      scopes: [MCP_TOOLS_SCOPE],
    });
    const { maybeBindOAuthRefreshResourceRequest } = await import(
      "@/lib/api/routes/auth-token-refresh-resource-binding"
    );
    const params = new URLSearchParams({
      grant_type: OAUTH_REFRESH_TOKEN_GRANT_TYPE,
      refresh_token: "refresh-token",
    });
    const request = refreshRequest(params);

    const result = await maybeBindOAuthRefreshResourceRequest(request, params);

    expect(result).not.toBe(request);
    const rewrittenBody = new URLSearchParams(await result.text());
    expect(rewrittenBody.get("resource")).toBe("https://life.example/api/mcp");
  });

  it("保留仅使用 legacy MCP feature scope 的刷新绑定", async () => {
    findRefreshTokenMock.mockResolvedValue({
      resources: ["https://life.example/api/mcp"],
      scopes: [mcpScope("profile")],
    });
    const { maybeBindOAuthRefreshResourceRequest } = await import(
      "@/lib/api/routes/auth-token-refresh-resource-binding"
    );
    const params = new URLSearchParams({
      grant_type: OAUTH_REFRESH_TOKEN_GRANT_TYPE,
      refresh_token: "refresh-token",
    });

    const result = await maybeBindOAuthRefreshResourceRequest(
      refreshRequest(params),
      params,
    );

    expect(new URLSearchParams(await result.text()).get("resource")).toBe(
      "https://life.example/api/mcp",
    );
  });

  it("规范化去重后仅有 GraphQL resource 时绑定省略资源的刷新", async () => {
    findRefreshTokenMock.mockResolvedValue({
      resources: [
        "https://life.example:443/api/graphql",
        "https://life.example/api/graphql",
      ],
      scopes: [restReadScope("todo")],
    });
    const { maybeBindOAuthRefreshResourceRequest } = await import(
      "@/lib/api/routes/auth-token-refresh-resource-binding"
    );
    const params = new URLSearchParams({
      grant_type: OAUTH_REFRESH_TOKEN_GRANT_TYPE,
      refresh_token: "refresh-token",
    });

    const result = await maybeBindOAuthRefreshResourceRequest(
      refreshRequest(params),
      params,
    );

    expect(new URLSearchParams(await result.text()).get("resource")).toBe(
      "https://life.example/api/graphql",
    );
  });

  it("GraphQL resource 缺少 feature scope 时不自动绑定", async () => {
    findRefreshTokenMock.mockResolvedValue({
      resources: ["https://life.example/api/graphql"],
      scopes: [OAUTH_PROFILE_SCOPE],
    });
    const { maybeBindOAuthRefreshResourceRequest } = await import(
      "@/lib/api/routes/auth-token-refresh-resource-binding"
    );
    const params = new URLSearchParams({
      grant_type: OAUTH_REFRESH_TOKEN_GRANT_TYPE,
      refresh_token: "refresh-token",
    });
    const request = refreshRequest(params);

    const result = await maybeBindOAuthRefreshResourceRequest(request, params);

    expect(result).toBe(request);
    expect(params.has("resource")).toBe(false);
  });

  it.each([
    ["空值", ""],
    ["非法 URL", "not-a-resource-url"],
  ])("stored resources 含%s时整体 fail-closed", async (_label, dirtyResource) => {
    findRefreshTokenMock.mockResolvedValue({
      resources: ["https://life.example/api/graphql", dirtyResource],
      scopes: [restReadScope("todo")],
    });
    const { maybeBindOAuthRefreshResourceRequest } = await import(
      "@/lib/api/routes/auth-token-refresh-resource-binding"
    );
    const params = new URLSearchParams({
      grant_type: OAUTH_REFRESH_TOKEN_GRANT_TYPE,
      refresh_token: "refresh-token",
    });
    const request = refreshRequest(params);

    await expect(
      maybeBindOAuthRefreshResourceRequest(request, params),
    ).resolves.toBe(request);
    expect(params.has("resource")).toBe(false);
  });

  it.each([
    [
      "REST 与 GraphQL",
      ["https://life.example/api/auth", "https://life.example/api/graphql"],
    ],
    [
      "MCP 与 GraphQL",
      ["https://life.example/api/mcp", "https://life.example/api/graphql"],
    ],
    [
      "REST 与 MCP",
      ["https://life.example/api/auth", "https://life.example/api/mcp"],
    ],
  ])("同时批准 %s resources 时不猜测刷新目标", async (_label, resources) => {
    findRefreshTokenMock.mockResolvedValue({
      resources,
      scopes: [restReadScope("todo")],
    });
    const { maybeBindOAuthRefreshResourceRequest } = await import(
      "@/lib/api/routes/auth-token-refresh-resource-binding"
    );
    const params = new URLSearchParams({
      grant_type: OAUTH_REFRESH_TOKEN_GRANT_TYPE,
      refresh_token: "refresh-token",
    });
    const request = refreshRequest(params);

    const result = await maybeBindOAuthRefreshResourceRequest(request, params);

    expect(result).toBe(request);
    expect(params.has("resource")).toBe(false);
  });

  it("已有显式 resource 时不改写刷新目标", async () => {
    const { maybeBindOAuthRefreshResourceRequest } = await import(
      "@/lib/api/routes/auth-token-refresh-resource-binding"
    );
    const params = new URLSearchParams({
      grant_type: OAUTH_REFRESH_TOKEN_GRANT_TYPE,
      refresh_token: "refresh-token",
      resource: "https://life.example/api/graphql",
    });
    const request = refreshRequest(params);

    const result = await maybeBindOAuthRefreshResourceRequest(request, params);

    expect(result).toBe(request);
    expect(findRefreshTokenMock).not.toHaveBeenCalled();
  });
});
