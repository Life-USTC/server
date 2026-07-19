import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  accessFindUniqueMock,
  betterAuthHandlerMock,
  decodeJwtMock,
  hasActiveOAuthUserGrantMock,
  refreshFindUniqueMock,
  verifyAccessTokenJwtMock,
} = vi.hoisted(() => ({
  accessFindUniqueMock: vi.fn(),
  betterAuthHandlerMock: vi.fn(),
  decodeJwtMock: vi.fn(),
  hasActiveOAuthUserGrantMock: vi.fn(),
  refreshFindUniqueMock: vi.fn(),
  verifyAccessTokenJwtMock: vi.fn(),
}));

vi.mock("jose", () => ({
  decodeJwt: decodeJwtMock,
}));

vi.mock("@/lib/auth/core", () => ({
  betterAuthInstance: {
    handler: betterAuthHandlerMock,
  },
}));

vi.mock("@/lib/auth/jwt-verification", () => ({
  verifyAccessTokenJwt: verifyAccessTokenJwtMock,
}));

vi.mock("@/lib/oauth/active-user-grant", () => ({
  hasActiveOAuthUserGrant: hasActiveOAuthUserGrantMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    oAuthAccessToken: {
      findUnique: accessFindUniqueMock,
    },
    oAuthClient: {
      findUnique: vi.fn(),
    },
    oAuthRefreshToken: {
      findUnique: refreshFindUniqueMock,
    },
  },
}));

vi.mock("@/lib/mcp/urls", () => ({
  getJwksUrlForOAuthVerification: () => "https://life.example/api/auth/jwks",
  getOAuthProviderValidAudiences: () => ["https://life.example/api/graphql"],
  getOAuthTokenVerificationIssuers: () => ["https://life.example/api/auth"],
}));

describe("OAuth JWT introspection grant state", () => {
  beforeEach(() => {
    betterAuthHandlerMock.mockReset();
    accessFindUniqueMock.mockReset();
    decodeJwtMock.mockReset();
    hasActiveOAuthUserGrantMock.mockReset();
    refreshFindUniqueMock.mockReset();
    verifyAccessTokenJwtMock.mockReset();
    betterAuthHandlerMock.mockResolvedValue(Response.json({ active: true }));
    decodeJwtMock.mockReturnValue({ sub: "user-1" });
    verifyAccessTokenJwtMock.mockResolvedValue({
      clientId: "client-1",
      grantId: "consent-1",
      scope: new Set(["todo:read"]),
      sub: "user-1",
      tokenScopes: ["todo:read"],
    });
  });

  function introspectionRequest(
    params: URLSearchParams = new URLSearchParams({
      token: "header.payload.signature",
    }),
  ) {
    return new Request("https://life.example/api/auth/oauth2/introspect", {
      body: params,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      method: "POST",
    });
  }

  it("reports a revoked consent-bound JWT as inactive", async () => {
    hasActiveOAuthUserGrantMock.mockResolvedValue(false);
    const { authPostRoute } = await import("@/lib/api/routes/auth");

    const response = await authPostRoute(introspectionRequest());

    await expect(response.json()).resolves.toEqual({ active: false });
    expect(hasActiveOAuthUserGrantMock).toHaveBeenCalledWith({
      clientId: "client-1",
      grantId: "consent-1",
      requireGrantBinding: true,
      scopes: ["todo:read"],
      userId: "user-1",
    });
  });

  it("preserves an active consent-bound JWT introspection response", async () => {
    hasActiveOAuthUserGrantMock.mockResolvedValue(true);
    const { authPostRoute } = await import("@/lib/api/routes/auth");

    const response = await authPostRoute(introspectionRequest());

    await expect(response.json()).resolves.toEqual({ active: true });
  });

  it("applies the same grant check to opaque access and refresh tokens", async () => {
    accessFindUniqueMock.mockResolvedValueOnce({
      clientId: "client-opaque",
      grantId: "grant-opaque",
      referenceId: "grant-opaque",
      scopes: ["profile"],
      userId: "user-1",
    });
    hasActiveOAuthUserGrantMock.mockResolvedValueOnce(false);
    const { authPostRoute } = await import("@/lib/api/routes/auth");

    const opaqueResponse = await authPostRoute(
      introspectionRequest(
        new URLSearchParams({
          token: "opaque-access-token",
          token_type_hint: "access_token",
        }),
      ),
    );
    await expect(opaqueResponse.json()).resolves.toEqual({ active: false });
    expect(hasActiveOAuthUserGrantMock).toHaveBeenLastCalledWith({
      clientId: "client-opaque",
      grantId: "grant-opaque",
      requireGrantBinding: true,
      scopes: ["profile"],
      userId: "user-1",
    });

    refreshFindUniqueMock.mockResolvedValueOnce({
      clientId: "client-refresh",
      grantId: "grant-refresh",
      referenceId: "grant-refresh",
      scopes: ["profile", "offline_access"],
      userId: "user-1",
    });
    hasActiveOAuthUserGrantMock.mockResolvedValueOnce(true);
    const refreshResponse = await authPostRoute(
      introspectionRequest(
        new URLSearchParams({
          token: "opaque-refresh-token",
          token_type_hint: "refresh_token",
        }),
      ),
    );
    await expect(refreshResponse.json()).resolves.toEqual({ active: true });
  });

  it("rejects duplicate singleton parameters before Better Auth", async () => {
    const params = new URLSearchParams({ token: "first" });
    params.append("token", "second");
    const { authPostRoute } = await import("@/lib/api/routes/auth");

    const response = await authPostRoute(introspectionRequest(params));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "invalid_request",
    });
    expect(betterAuthHandlerMock).not.toHaveBeenCalled();
  });
});
