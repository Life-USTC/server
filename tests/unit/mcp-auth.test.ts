import { beforeEach, describe, expect, it, vi } from "vitest";
import { restReadScope, restWriteScope } from "@/lib/oauth/constants";

const verifyOAuthAccessTokenMock = vi.fn();
const getJwksMock = vi.fn();
const hasActiveOAuthUserGrantMock = vi.fn();

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

vi.mock("@/lib/oauth/active-user-grant", () => ({
  hasActiveOAuthUserGrant: hasActiveOAuthUserGrantMock,
}));

vi.mock("@/lib/auth/core", () => ({
  authApi: {
    getJwks: getJwksMock,
  },
}));

vi.mock("better-auth/oauth2", () => ({
  verifyJwsAccessToken: verifyOAuthAccessTokenMock,
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
    getJwksMock.mockReset();
    verifyOAuthAccessTokenMock.mockReset();
    hasActiveOAuthUserGrantMock.mockReset();
    hasActiveOAuthUserGrantMock.mockResolvedValue(true);
  });

  it("使用本地 JWKS 和规范 OAuth issuer 校验 JWT access token", async () => {
    getJwksMock.mockResolvedValue({ keys: [] });
    verifyOAuthAccessTokenMock.mockResolvedValue({
      azp: "client-id",
      aud: "https://life.example/api/mcp",
      exp: 1_900_000_000,
      scope: restReadScope("workspace.todo"),
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
        jwksFetch: expect.any(Function),
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
    const verifyOptions = verifyOAuthAccessTokenMock.mock.calls[0]?.[1] as {
      jwksFetch?: () => Promise<unknown>;
    };
    await expect(verifyOptions.jwksFetch?.()).resolves.toEqual({ keys: [] });
    expect(getJwksMock).toHaveBeenCalledWith({});
    expect(authInfo).toMatchObject({
      clientId: "client-id",
      extra: { userId: "user-id" },
    });
    expect("scopes" in authInfo && authInfo.scopes).toContain(
      restReadScope("workspace.todo"),
    );
  });

  it("拒绝已撤销、缺少 azp 或无法查询授权状态的 MCP JWT", async () => {
    const { verifyAccessToken } = await import("@/lib/mcp/auth");
    const request = new Request("https://life.example/api/mcp");
    const validClaims = {
      azp: "client-id",
      aud: "https://life.example/api/mcp",
      exp: 1_900_000_000,
      scope: restReadScope("workspace.todo"),
      sub: "user-id",
    };

    verifyOAuthAccessTokenMock.mockResolvedValue(validClaims);
    hasActiveOAuthUserGrantMock.mockResolvedValueOnce(false);
    await expect(
      verifyAccessToken(request, "header.payload.signature"),
    ).resolves.toMatchObject({
      diagnostics: { authFailureKind: "inactive_oauth_grant" },
      error: "invalid_token",
      status: 401,
    });

    verifyOAuthAccessTokenMock.mockResolvedValue({
      ...validClaims,
      azp: undefined,
    });
    await expect(
      verifyAccessToken(request, "header.payload.signature"),
    ).resolves.toMatchObject({
      diagnostics: { authFailureKind: "inactive_oauth_grant" },
      status: 401,
    });

    verifyOAuthAccessTokenMock.mockResolvedValue(validClaims);
    hasActiveOAuthUserGrantMock.mockRejectedValueOnce(
      new Error("database unavailable"),
    );
    await expect(
      verifyAccessToken(request, "header.payload.signature"),
    ).resolves.toMatchObject({
      diagnostics: { authFailureKind: "inactive_oauth_grant" },
      status: 401,
    });
  });
});

describe("authenticateMcpRequest per-tool scope enforcement", () => {
  beforeEach(() => {
    vi.resetModules();
    getJwksMock.mockReset();
    verifyOAuthAccessTokenMock.mockReset();
    hasActiveOAuthUserGrantMock.mockReset();
    hasActiveOAuthUserGrantMock.mockResolvedValue(true);
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

  it("returns diagnostics when the bearer token is missing", async () => {
    const { authenticateMcpRequest } = await import("@/lib/mcp/auth");
    const result = await authenticateMcpRequest(
      new Request("https://life.example/api/mcp"),
      "workspace_todo_list",
    );

    expect("response" in result).toBe(true);
    if ("response" in result) {
      expect(result.response.status).toBe(401);
      expect(result.authFailureDiagnostics).toMatchObject({
        authFailureKind: "missing_bearer",
        authHeaderKind: "missing",
        authTokenFormat: "missing",
      });
    }
  });

  it("returns diagnostics when JWT verification fails", async () => {
    verifyOAuthAccessTokenMock.mockRejectedValue(new Error("bad jwt"));
    const { authenticateMcpRequest } = await import("@/lib/mcp/auth");
    const result = await authenticateMcpRequest(
      makeAuthenticatedRequest([restReadScope("workspace.todo")]),
      "workspace_todo_list",
    );

    expect("response" in result).toBe(true);
    if ("response" in result) {
      expect(result.response.status).toBe(401);
      expect(result.authFailureDiagnostics).toMatchObject({
        acceptedAudienceCount: 3,
        acceptedIssuerCount: 1,
        authFailureKind: "jwt_verify_failed",
        authHeaderKind: "bearer",
        authTokenFormat: "jwt",
        jwtErrorName: "Error",
      });
      expect(JSON.stringify(result.authFailureDiagnostics)).not.toContain(
        "bad jwt",
      );
    }
  });

  it("returns diagnostics when an opaque token cannot be matched", async () => {
    const { authenticateMcpRequest } = await import("@/lib/mcp/auth");
    const result = await authenticateMcpRequest(
      new Request("https://life.example/api/mcp", {
        headers: { authorization: "Bearer opaque-token" },
      }),
      "workspace_todo_list",
    );

    expect("response" in result).toBe(true);
    if ("response" in result) {
      expect(result.response.status).toBe(401);
      expect(result.authFailureDiagnostics).toMatchObject({
        authFailureKind: "opaque_token_miss",
        authHeaderKind: "bearer",
        authTokenFormat: "opaque",
      });
    }
  });

  it("allows a tool when the token has the matching feature scope", async () => {
    mockToken([restReadScope("workspace.todo")]);
    const { authenticateMcpRequest } = await import("@/lib/mcp/auth");
    const result = await authenticateMcpRequest(
      makeAuthenticatedRequest([restReadScope("workspace.todo")]),
      "workspace_todo_list",
    );

    expect("authInfo" in result).toBe(true);
    if ("authInfo" in result) {
      expect(result.authInfo.scopes).toContain(restReadScope("workspace.todo"));
    }
  });

  it("rejects the removed coarse mcp:tools scope", async () => {
    mockToken(["mcp:tools"]);
    const { authenticateMcpRequest } = await import("@/lib/mcp/auth");
    const result = await authenticateMcpRequest(
      makeAuthenticatedRequest(["mcp:tools"]),
      "community_comment_create",
    );

    expect("response" in result).toBe(true);
  });

  it("rejects a tool when the token lacks the required feature scope", async () => {
    mockToken([restReadScope("workspace.todo")]);
    const { authenticateMcpRequest } = await import("@/lib/mcp/auth");
    const result = await authenticateMcpRequest(
      makeAuthenticatedRequest([restReadScope("workspace.todo")]),
      "community_comment_create",
    );

    expect("response" in result).toBe(true);
    if ("response" in result) {
      expect(result.response.status).toBe(403);
      expect(result.authFailureDiagnostics).toMatchObject({
        authFailureKind: "missing_required_tool_scope",
        authHeaderKind: "bearer",
        authTokenFormat: "jwt",
        requiredScopeCount: 1,
        scopeCount: 1,
        tokenResourceMatchesMcp: true,
        tokenResourcePresent: true,
        toolNameCount: 1,
      });
      const www = result.response.headers.get("www-authenticate");
      expect(www).toContain("insufficient_scope");
      expect(www).toContain(restWriteScope("community.comment"));
    }
  });

  it("rejects a mixed-tool batch unless every tool scope is present", async () => {
    mockToken([restWriteScope("workspace.todo")]);
    const { authenticateMcpRequest } = await import("@/lib/mcp/auth");
    const result = await authenticateMcpRequest(
      makeAuthenticatedRequest([restWriteScope("workspace.todo")]),
      ["workspace_todo_create", "workspace_upload_delete"],
    );

    expect("response" in result).toBe(true);
    if ("response" in result) {
      expect(result.response.status).toBe(403);
      expect(result.authFailureDiagnostics).toMatchObject({
        authFailureKind: "missing_required_tool_scope",
        requiredScopeCount: 2,
        toolNameCount: 2,
      });
      expect(result.response.headers.get("www-authenticate")).toContain(
        restWriteScope("workspace.upload"),
      );
    }
  });

  it("lets a feature write scope satisfy reads of the same feature", async () => {
    mockToken([restWriteScope("workspace.todo")]);
    const { authenticateMcpRequest } = await import("@/lib/mcp/auth");
    const result = await authenticateMcpRequest(
      makeAuthenticatedRequest([restWriteScope("workspace.todo")]),
      ["workspace_todo_list", "workspace_todo_create"],
    );

    expect("authInfo" in result).toBe(true);
  });

  it("requires every declared scope for a cross-cutting tool", async () => {
    mockToken([restReadScope("workspace.schedule")]);
    const { authenticateMcpRequest } = await import("@/lib/mcp/auth");
    const result = await authenticateMcpRequest(
      makeAuthenticatedRequest([restReadScope("workspace.schedule")]),
      "workspace_schedule_next",
    );

    expect("response" in result).toBe(true);
    if ("response" in result) {
      expect(result.response.status).toBe(403);
      expect(result.response.headers.get("www-authenticate")).toContain(
        restReadScope("workspace.overview"),
      );
    }
  });

  it("still requires any MCP scope before the per-tool check", async () => {
    mockToken(["openid"]);
    const { authenticateMcpRequest } = await import("@/lib/mcp/auth");
    const result = await authenticateMcpRequest(
      makeAuthenticatedRequest(["openid"]),
      "workspace_todo_list",
    );

    expect("response" in result).toBe(true);
    if ("response" in result) {
      expect(result.response.status).toBe(403);
      expect(result.authFailureDiagnostics).toMatchObject({
        authFailureKind: "missing_feature_scope",
        authHeaderKind: "bearer",
        authTokenFormat: "jwt",
        scopeCount: 1,
        tokenResourceMatchesMcp: true,
        tokenResourcePresent: true,
      });
      const www = result.response.headers.get("www-authenticate");
      expect(www).toContain("insufficient_scope");
      expect(www).toContain(restReadScope("workspace.todo"));
      expect(www).not.toContain(restReadScope("admin"));
      expect(www).not.toContain(restWriteScope("admin"));
    }
  });

  it("allows unmapped tools when the token has any MCP scope", async () => {
    mockToken([restReadScope("account.profile")]);
    const { authenticateMcpRequest } = await import("@/lib/mcp/auth");
    const result = await authenticateMcpRequest(
      makeAuthenticatedRequest([restReadScope("account.profile")]),
      "not_a_real_tool",
    );

    expect("authInfo" in result).toBe(true);
  });
});
