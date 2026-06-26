import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MCP_TOOLS_SCOPE,
  OAUTH_REFRESH_TOKEN_GRANT_TYPE,
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

vi.mock("@/lib/mcp/urls", () => ({
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

describe("MCP refresh resource binding", () => {
  beforeEach(() => {
    vi.resetModules();
    findRefreshTokenMock.mockReset();
  });

  it("does not bind a resource-less mcp:tools refresh grant to the MCP resource", async () => {
    findRefreshTokenMock.mockResolvedValue({
      resources: [],
      scopes: [MCP_TOOLS_SCOPE],
    });
    const { maybeBindMcpRefreshRequest } = await import(
      "@/lib/api/routes/auth-token-mcp-refresh-binding"
    );
    const params = new URLSearchParams({
      grant_type: OAUTH_REFRESH_TOKEN_GRANT_TYPE,
      refresh_token: "refresh-token",
    });
    const request = refreshRequest(params);

    const result = await maybeBindMcpRefreshRequest(request, params);

    expect(result).toBe(request);
    expect(params.has("resource")).toBe(false);
  });

  it("does not bind a non-MCP-approved refresh grant to the MCP resource", async () => {
    findRefreshTokenMock.mockResolvedValue({
      resources: ["https://life.example/api/auth"],
      scopes: [MCP_TOOLS_SCOPE],
    });
    const { maybeBindMcpRefreshRequest } = await import(
      "@/lib/api/routes/auth-token-mcp-refresh-binding"
    );
    const params = new URLSearchParams({
      grant_type: OAUTH_REFRESH_TOKEN_GRANT_TYPE,
      refresh_token: "refresh-token",
    });
    const request = refreshRequest(params);

    const result = await maybeBindMcpRefreshRequest(request, params);

    expect(result).toBe(request);
    expect(params.has("resource")).toBe(false);
  });

  it("binds omitted-resource refresh only when the stored grant includes the MCP resource", async () => {
    findRefreshTokenMock.mockResolvedValue({
      resources: ["https://life.example/api/mcp"],
      scopes: [MCP_TOOLS_SCOPE],
    });
    const { maybeBindMcpRefreshRequest } = await import(
      "@/lib/api/routes/auth-token-mcp-refresh-binding"
    );
    const params = new URLSearchParams({
      grant_type: OAUTH_REFRESH_TOKEN_GRANT_TYPE,
      refresh_token: "refresh-token",
    });
    const request = refreshRequest(params);

    const result = await maybeBindMcpRefreshRequest(request, params);

    expect(result).not.toBe(request);
    const rewrittenBody = new URLSearchParams(await result.text());
    expect(rewrittenBody.get("resource")).toBe("https://life.example/api/mcp");
  });
});
