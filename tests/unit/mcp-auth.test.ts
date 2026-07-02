import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MCP_TOOLS_SCOPE,
  restReadScope,
  restWriteScope,
} from "@/lib/oauth/constants";
import { LEGACY_MCP_TOOLS_SCOPE } from "@/lib/oauth/scope-registry";

const verifyOAuthAccessTokenMock = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    oAuthAccessToken: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/log/oauth-debug", () => ({
  isOAuthDebugLogging: () => false,
  logOAuthDebug: vi.fn(),
}));

vi.mock("better-auth/oauth2", () => ({
  verifyAccessToken: verifyOAuthAccessTokenMock,
}));

vi.mock("@/lib/mcp/urls", () => ({
  getJwksUrlForOAuthVerification: () => "https://life.example/api/auth/jwks",
  getOAuthMcpAudienceUrls: () => [
    "https://life.example/api/mcp",
    "https://life.example/api/auth/oauth2/userinfo",
    "https://life.example/api/auth",
  ],
  getOAuthMcpResourceUrl: () => "https://life.example/api/mcp",
  getOAuthProtectedResourceMetadataUrl: () =>
    new URL(
      "https://life.example/.well-known/oauth-protected-resource/api/mcp",
    ),
  getOAuthTokenVerificationIssuers: () => ["https://life.example/api/auth"],
}));

describe("MCP 认证", () => {
  beforeEach(() => {
    vi.resetModules();
    verifyOAuthAccessTokenMock.mockReset();
  });

  it("使用规范 OAuth issuer 校验 JWT access token", async () => {
    verifyOAuthAccessTokenMock.mockResolvedValue({
      azp: "client-id",
      aud: "https://life.example/api/mcp",
      exp: 1_900_000_000,
      scope: MCP_TOOLS_SCOPE,
      sub: "user-id",
    });
    const { verifyAccessToken } = await import("@/lib/mcp/auth");

    const authInfo = await verifyAccessToken(
      new Request("https://life.example/api/mcp"),
      "header.payload.signature",
    );

    expect(verifyOAuthAccessTokenMock).toHaveBeenCalledWith(
      "header.payload.signature",
      expect.objectContaining({
        jwksUrl: "https://life.example/api/auth/jwks",
        verifyOptions: {
          issuer: ["https://life.example/api/auth"],
          audience: [
            "https://life.example/api/mcp",
            "https://life.example/api/auth/oauth2/userinfo",
            "https://life.example/api/auth",
          ],
        },
      }),
    );
    expect(authInfo).toMatchObject({
      clientId: "client-id",
      extra: { userId: "user-id" },
    });
    expect("scopes" in authInfo && authInfo.scopes).toContain(
      restReadScope("todo"),
    );
  });
});

describe("authenticateMcpRequest per-tool scope enforcement", () => {
  beforeEach(() => {
    vi.resetModules();
    verifyOAuthAccessTokenMock.mockReset();
  });

  function makeAuthenticatedRequest(_scopes: string[]) {
    return new Request("https://life.example/api/mcp", {
      headers: { authorization: "Bearer header.payload.signature" },
    });
  }

  function mockToken(scopes: string[]) {
    verifyOAuthAccessTokenMock.mockResolvedValue({
      azp: "client-id",
      aud: "https://life.example/api/mcp",
      exp: 1_900_000_000,
      scope: scopes.join(" "),
      sub: "user-id",
    });
  }

  it("allows a tool when the token has the matching feature scope", async () => {
    mockToken([restReadScope("todo")]);
    const { authenticateMcpRequest } = await import("@/lib/mcp/auth");
    const result = await authenticateMcpRequest(
      makeAuthenticatedRequest([restReadScope("todo")]),
      "list_my_todos",
    );

    expect("authInfo" in result).toBe(true);
    if ("authInfo" in result) {
      expect(result.authInfo.scopes).toContain(restReadScope("todo"));
    }
  });

  it("allows any tool when the token has the legacy mcp:tools scope", async () => {
    mockToken([LEGACY_MCP_TOOLS_SCOPE]);
    const { authenticateMcpRequest } = await import("@/lib/mcp/auth");
    const result = await authenticateMcpRequest(
      makeAuthenticatedRequest([LEGACY_MCP_TOOLS_SCOPE]),
      "create_comment",
    );

    expect("authInfo" in result).toBe(true);
  });

  it("rejects a tool when the token lacks the required feature scope", async () => {
    mockToken([restReadScope("todo")]);
    const { authenticateMcpRequest } = await import("@/lib/mcp/auth");
    const result = await authenticateMcpRequest(
      makeAuthenticatedRequest([restReadScope("todo")]),
      "create_comment",
    );

    expect("response" in result).toBe(true);
    if ("response" in result) {
      expect(result.response.status).toBe(403);
      const www = result.response.headers.get("www-authenticate");
      expect(www).toContain("insufficient_scope");
      expect(www).toContain(restWriteScope("comment"));
    }
  });

  it("still requires any MCP scope before the per-tool check", async () => {
    mockToken(["openid"]);
    const { authenticateMcpRequest } = await import("@/lib/mcp/auth");
    const result = await authenticateMcpRequest(
      makeAuthenticatedRequest(["openid"]),
      "list_my_todos",
    );

    expect("response" in result).toBe(true);
    if ("response" in result) {
      expect(result.response.status).toBe(403);
      const www = result.response.headers.get("www-authenticate");
      expect(www).toContain("insufficient_scope");
      expect(www).toContain(restReadScope("todo"));
      expect(www).not.toContain(restReadScope("admin"));
      expect(www).not.toContain(restWriteScope("admin"));
    }
  });

  it("allows unmapped tools when the token has any MCP scope", async () => {
    mockToken([restReadScope("me")]);
    const { authenticateMcpRequest } = await import("@/lib/mcp/auth");
    const result = await authenticateMcpRequest(
      makeAuthenticatedRequest([restReadScope("me")]),
      "not_a_real_tool",
    );

    expect("authInfo" in result).toBe(true);
  });
});
