import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildBearerChallenge } from "@/lib/mcp/auth-errors";
import { restReadScope, restWriteScope } from "@/lib/oauth/constants";

const { createMcpProtectedRequestHandlerMock, hasActiveOAuthUserGrantMock } =
  vi.hoisted(() => ({
    hasActiveOAuthUserGrantMock: vi.fn(),
    createMcpProtectedRequestHandlerMock: vi.fn(),
  }));

vi.mock("@better-auth/mcp", () => ({
  createMcpProtectedRequestHandler: createMcpProtectedRequestHandlerMock,
}));

vi.mock("@/lib/oauth/active-user-grant", () => ({
  hasActiveOAuthUserGrant: hasActiveOAuthUserGrantMock,
}));

vi.mock("@/lib/mcp/urls", () => ({
  getCanonicalOAuthIssuer: () => "https://life.example/api/auth",
  getJwksUrlForOAuthVerification: () => "https://life.example/api/auth/jwks",
  getOAuthMcpResourceUrl: () => "https://life.example/api/mcp",
  getOAuthMcpResourceUrls: () => [
    "https://life.example/api/mcp",
    "https://loopback.example/api/mcp",
  ],
  getOAuthProtectedResourceMetadataUrl: () =>
    new URL(
      "https://life.example/.well-known/oauth-protected-resource/api/mcp",
    ),
}));

const TODO_READ_SCOPE = restReadScope("workspace.todo");
const TODO_WRITE_SCOPE = restWriteScope("workspace.todo");
const GRANT_ID_CLAIM = "urn:life-ustc:oauth:grant-id";

type UpstreamMode =
  | { kind: "accept"; claims: Record<string, unknown> }
  | { kind: "reject"; response: Response };

let upstreamMode: UpstreamMode;

function validClaims(
  scopes: string[] = [TODO_READ_SCOPE],
  overrides: Record<string, unknown> = {},
) {
  return {
    azp: "client-id",
    aud: "https://life.example/api/mcp",
    exp: 1_900_000_000,
    scope: scopes.join(" "),
    sub: "user-id",
    [GRANT_ID_CLAIM]: "grant-id",
    ...overrides,
  };
}

function authenticatedRequest(scheme: "Bearer" | "DPoP" = "Bearer") {
  return new Request("https://life.example/api/mcp", {
    method: "POST",
    headers: {
      authorization: `${scheme} header.payload.signature`,
      ...(scheme === "DPoP" ? { DPoP: "proof.jwt.value" } : {}),
    },
  });
}

function rejectUpstream(challenge: string) {
  upstreamMode = {
    kind: "reject",
    response: new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32000, message: "upstream rejection" },
        id: null,
      }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "WWW-Authenticate": challenge,
        },
      },
    ),
  };
}

describe("MCP Bearer challenge", () => {
  it("escapes quoted-string values and rejects control characters", () => {
    const challenge = buildBearerChallenge({
      description: "bad\\value",
      error: 'invalid"token',
      scopes: ['scope"one'],
    });

    expect(challenge).toContain('error="invalid\\"token"');
    expect(challenge).toContain('error_description="bad\\\\value"');
    expect(challenge).toContain('scope="scope\\"one"');
    expect(() =>
      buildBearerChallenge({
        description: "bad\nvalue",
        error: "invalid_token",
      }),
    ).toThrow(/control characters/);
  });
});

describe("MCP upstream authentication", () => {
  beforeEach(() => {
    vi.resetModules();
    hasActiveOAuthUserGrantMock.mockReset().mockResolvedValue(true);
    createMcpProtectedRequestHandlerMock
      .mockReset()
      .mockImplementation((_options, handler) => {
        return async (request: Request) => {
          if (upstreamMode.kind === "reject") return upstreamMode.response;
          return handler(request, upstreamMode.claims);
        };
      });
    upstreamMode = { kind: "accept", claims: validClaims() };
  });

  it("uses the protected-request handler with explicit verification options", async () => {
    const { authenticateMcpRequest } = await import("@/lib/mcp/auth");

    const first = await authenticateMcpRequest(authenticatedRequest());
    const second = await authenticateMcpRequest(authenticatedRequest());

    expect(first).toMatchObject({
      authInfo: {
        clientId: "client-id",
        extra: { userId: "user-id" },
        scopes: [TODO_READ_SCOPE],
      },
    });
    expect(second).toMatchObject({ authInfo: { clientId: "client-id" } });
    expect(createMcpProtectedRequestHandlerMock).toHaveBeenCalledWith(
      {
        issuer: "https://life.example/api/auth",
        audience: "https://life.example/api/mcp",
        jwksUrl: "https://life.example/api/auth/jwks",
      },
      expect.any(Function),
    );
    expect(hasActiveOAuthUserGrantMock).toHaveBeenCalledWith({
      clientId: "client-id",
      grantId: "grant-id",
      requireGrantBinding: true,
      scopes: [TODO_READ_SCOPE],
      userId: "user-id",
    });
  });

  it("preserves upstream JSON-RPC rejection and adds the bootstrap scope to every Bearer challenge", async () => {
    rejectUpstream(
      'Bearer resource_metadata="https://life.example/.well-known/oauth-protected-resource/api/mcp", Bearer resource_metadata="https://loopback.example/.well-known/oauth-protected-resource/api/mcp"',
    );
    const { authenticateMcpRequest } = await import("@/lib/mcp/auth");

    const result = await authenticateMcpRequest(
      new Request("https://life.example/api/mcp", { method: "POST" }),
    );

    expect("response" in result).toBe(true);
    if (!("response" in result)) return;
    expect(result.authFailureDiagnostics).toEqual({
      authFailureKind: "missing_bearer",
      authHeaderKind: "missing",
      authTokenFormat: "missing",
    });
    expect(result.response.status).toBe(401);
    await expect(result.response.clone().json()).resolves.toEqual({
      jsonrpc: "2.0",
      error: { code: -32000, message: "upstream rejection" },
      id: null,
    });
    const challenge = result.response.headers.get("WWW-Authenticate") ?? "";
    expect(challenge.match(/scope="account\.profile:read"/g)).toHaveLength(2);
  });

  it("keeps the MCP resource Bearer-only and rejects DPoP before upstream verification", async () => {
    const { authenticateMcpRequest } = await import("@/lib/mcp/auth");

    const result = await authenticateMcpRequest(authenticatedRequest("DPoP"));

    expect("response" in result).toBe(true);
    if (!("response" in result)) return;
    expect(result.authFailureDiagnostics).toMatchObject({
      authFailureKind: "unsupported_dpop",
      authHeaderKind: "dpop",
      authTokenFormat: "jwt",
    });
    expect(result.response.headers.get("WWW-Authenticate")).toContain(
      "Bearer error=",
    );
    expect(createMcpProtectedRequestHandlerMock).not.toHaveBeenCalled();
  });

  it("classifies opaque tokens rejected by the upstream JWT verifier", async () => {
    rejectUpstream(
      'Bearer resource_metadata="https://life.example/.well-known/oauth-protected-resource/api/mcp"',
    );
    const { authenticateMcpRequest } = await import("@/lib/mcp/auth");

    const result = await authenticateMcpRequest(
      new Request("https://life.example/api/mcp", {
        headers: { authorization: "Bearer opaque-token" },
      }),
    );

    expect(result).toMatchObject({
      authFailureDiagnostics: {
        authFailureKind: "upstream_auth_rejected",
        authHeaderKind: "bearer",
        authTokenFormat: "opaque",
      },
    });
  });

  it("accepts upstream client_id and rejects conflicting client identifiers", async () => {
    upstreamMode = {
      kind: "accept",
      claims: validClaims(undefined, {
        azp: undefined,
        client_id: "client-id",
      }),
    };
    const { authenticateMcpRequest } = await import("@/lib/mcp/auth");
    await expect(
      authenticateMcpRequest(authenticatedRequest()),
    ).resolves.toMatchObject({ authInfo: { clientId: "client-id" } });

    upstreamMode = {
      kind: "accept",
      claims: validClaims(undefined, { client_id: "different-client" }),
    };
    await expect(
      authenticateMcpRequest(authenticatedRequest()),
    ).resolves.toMatchObject({
      authFailureDiagnostics: { authFailureKind: "inactive_oauth_grant" },
      response: expect.objectContaining({ status: 401 }),
    });
  });

  it("fails closed for revoked, unbound, or unverifiable grants", async () => {
    const { authenticateMcpRequest } = await import("@/lib/mcp/auth");

    hasActiveOAuthUserGrantMock.mockResolvedValueOnce(false);
    await expect(
      authenticateMcpRequest(authenticatedRequest()),
    ).resolves.toMatchObject({
      authFailureDiagnostics: { authFailureKind: "inactive_oauth_grant" },
      response: expect.objectContaining({ status: 401 }),
    });

    upstreamMode = {
      kind: "accept",
      claims: validClaims(undefined, { azp: undefined, client_id: undefined }),
    };
    await expect(
      authenticateMcpRequest(authenticatedRequest()),
    ).resolves.toMatchObject({
      authFailureDiagnostics: { authFailureKind: "inactive_oauth_grant" },
    });

    upstreamMode = { kind: "accept", claims: validClaims() };
    hasActiveOAuthUserGrantMock.mockRejectedValueOnce(
      new Error("database unavailable"),
    );
    await expect(
      authenticateMcpRequest(authenticatedRequest()),
    ).resolves.toMatchObject({
      authFailureDiagnostics: { authFailureKind: "inactive_oauth_grant" },
    });
  });
});

describe("MCP per-tool scope enforcement", () => {
  beforeEach(() => {
    vi.resetModules();
    hasActiveOAuthUserGrantMock.mockReset().mockResolvedValue(true);
    createMcpProtectedRequestHandlerMock
      .mockReset()
      .mockImplementation((_options, handler) => {
        return async (request: Request) => {
          if (upstreamMode.kind !== "accept") return upstreamMode.response;
          return handler(request, upstreamMode.claims);
        };
      });
    upstreamMode = { kind: "accept", claims: validClaims() };
  });

  async function authenticate(scopes: string[], tools: string | string[]) {
    upstreamMode = { kind: "accept", claims: validClaims(scopes) };
    const { authenticateMcpRequest } = await import("@/lib/mcp/auth");
    return authenticateMcpRequest(authenticatedRequest(), tools);
  }

  it("allows exact scope and lets write satisfy read", async () => {
    await expect(
      authenticate([TODO_READ_SCOPE], "workspace_todo_list"),
    ).resolves.toMatchObject({ authInfo: { scopes: [TODO_READ_SCOPE] } });
    await expect(
      authenticate(
        [TODO_WRITE_SCOPE],
        ["workspace_todo_list", "workspace_todo_create"],
      ),
    ).resolves.toMatchObject({ authInfo: { scopes: [TODO_WRITE_SCOPE] } });
  });

  it("rejects removed coarse scope and identity-only scopes", async () => {
    await expect(
      authenticate(["mcp:tools"], "workspace_todo_list"),
    ).resolves.toMatchObject({
      authFailureDiagnostics: { authFailureKind: "missing_feature_scope" },
      response: expect.objectContaining({ status: 403 }),
    });
    await expect(
      authenticate(["openid"], "workspace_todo_list"),
    ).resolves.toMatchObject({
      authFailureDiagnostics: { authFailureKind: "missing_feature_scope" },
    });
  });

  it("requires every scope in a mixed-tool batch", async () => {
    const result = await authenticate(
      [TODO_WRITE_SCOPE],
      ["workspace_todo_create", "workspace_upload_delete"],
    );

    expect(result).toMatchObject({
      authFailureDiagnostics: {
        authFailureKind: "missing_required_tool_scope",
        requiredScopeCount: 2,
        toolNameCount: 2,
      },
      response: expect.objectContaining({ status: 403 }),
    });
    if ("response" in result) {
      const challenge = result.response.headers.get("WWW-Authenticate") ?? "";
      expect(challenge).toContain(TODO_WRITE_SCOPE);
      expect(challenge).toContain(restWriteScope("workspace.upload"));
    }
  });

  it("retains already granted scopes in a step-up challenge", async () => {
    const profileScope = restReadScope("account.profile");
    const result = await authenticate(
      [profileScope, TODO_READ_SCOPE],
      "workspace_todo_create",
    );

    expect("response" in result).toBe(true);
    if ("response" in result) {
      const challenge = result.response.headers.get("WWW-Authenticate") ?? "";
      expect(challenge).toContain(
        `scope="${profileScope} ${TODO_READ_SCOPE} ${TODO_WRITE_SCOPE}"`,
      );
    }
  });

  it("requires every declared scope for a cross-cutting tool", async () => {
    const result = await authenticate(
      [restReadScope("workspace.schedule")],
      "workspace_schedule_next",
    );

    expect("response" in result).toBe(true);
    if ("response" in result) {
      expect(result.response.headers.get("WWW-Authenticate")).toContain(
        restReadScope("workspace.overview"),
      );
    }
  });

  it("does not reflect attacker-controlled tool names into the challenge", async () => {
    const result = await authenticate(
      [TODO_WRITE_SCOPE],
      ["community_comment_create", '", scope="evil'],
    );

    expect("response" in result).toBe(true);
    if ("response" in result) {
      const challenge = result.response.headers.get("WWW-Authenticate") ?? "";
      expect(challenge).toContain(restWriteScope("community.comment"));
      expect(challenge).not.toContain("evil");
    }
  });

  it("allows an unmapped tool after the generic feature-scope gate", async () => {
    await expect(
      authenticate([restReadScope("account.profile")], "not_a_real_tool"),
    ).resolves.toMatchObject({ authInfo: { clientId: "client-id" } });
  });
});
