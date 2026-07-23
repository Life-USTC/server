import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  accessFindUniqueMock,
  betterAuthHandlerMock,
  decodeJwtMock,
  hasActiveOAuthUserGrantMock,
  logAppEventMock,
  refreshFindUniqueMock,
  verifyAccessTokenJwtMock,
} = vi.hoisted(() => ({
  accessFindUniqueMock: vi.fn(),
  betterAuthHandlerMock: vi.fn(),
  decodeJwtMock: vi.fn(),
  hasActiveOAuthUserGrantMock: vi.fn(),
  logAppEventMock: vi.fn(),
  refreshFindUniqueMock: vi.fn(),
  verifyAccessTokenJwtMock: vi.fn(),
}));

vi.mock("@/lib/log/app-logger", () => ({
  logAppEvent: logAppEventMock,
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
    logAppEventMock.mockReset();
    refreshFindUniqueMock.mockReset();
    verifyAccessTokenJwtMock.mockReset();
    betterAuthHandlerMock.mockResolvedValue(Response.json({ active: true }));
    decodeJwtMock.mockReturnValue({ sub: "user-1" });
    verifyAccessTokenJwtMock.mockResolvedValue({
      clientId: "client-1",
      grantId: "consent-1",
      scope: new Set(["workspace.todo:read"]),
      sub: "user-1",
      tokenScopes: ["workspace.todo:read"],
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
      scopes: ["workspace.todo:read"],
      userId: "user-1",
    });
  });

  it("preserves an active consent-bound JWT introspection response", async () => {
    hasActiveOAuthUserGrantMock.mockResolvedValue(true);
    const { authPostRoute } = await import("@/lib/api/routes/auth");

    const response = await authPostRoute(introspectionRequest());

    await expect(response.json()).resolves.toEqual({ active: true });
  });

  it("fails closed and records unexpected grant verification failures", async () => {
    const privateError = new TypeError("private database detail");
    hasActiveOAuthUserGrantMock.mockRejectedValue(privateError);
    const { authPostRoute } = await import("@/lib/api/routes/auth");

    const response = await authPostRoute(introspectionRequest());

    await expect(response.json()).resolves.toEqual({ active: false });
    expect(logAppEventMock).toHaveBeenCalledWith(
      "error",
      "oauth.introspection.grant-verification-failed",
      expect.objectContaining({
        event: "oauth.introspection.grant-verification-failed",
        method: "POST",
        phase: "grant-verification",
      }),
      privateError,
    );
    expect(JSON.stringify(logAppEventMock.mock.calls)).not.toContain(
      "header.payload.signature",
    );
  });

  it("uses trusted opaque reference generations when applying replay-tombstone state", async () => {
    accessFindUniqueMock.mockResolvedValueOnce({
      clientId: "client-opaque",
      grantId: null,
      referenceId: "trusted-access-generation",
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
    expect(accessFindUniqueMock).toHaveBeenCalledWith({
      where: { token: expect.any(String) },
      select: {
        clientId: true,
        grantId: true,
        referenceId: true,
        scopes: true,
        userId: true,
      },
    });
    expect(hasActiveOAuthUserGrantMock).toHaveBeenLastCalledWith({
      clientId: "client-opaque",
      grantId: "trusted-access-generation",
      requireGrantBinding: true,
      scopes: ["profile"],
      userId: "user-1",
    });

    refreshFindUniqueMock.mockResolvedValueOnce({
      clientId: "client-refresh",
      grantId: null,
      referenceId: "trusted-refresh-generation",
      scopes: ["profile", "offline_access"],
      userId: "user-1",
    });
    hasActiveOAuthUserGrantMock.mockResolvedValueOnce(false);
    const refreshResponse = await authPostRoute(
      introspectionRequest(
        new URLSearchParams({
          token: "opaque-refresh-token",
          token_type_hint: "refresh_token",
        }),
      ),
    );
    await expect(refreshResponse.json()).resolves.toEqual({ active: false });
    expect(refreshFindUniqueMock).toHaveBeenCalledWith({
      where: { token: expect.any(String) },
      select: {
        clientId: true,
        grantId: true,
        referenceId: true,
        scopes: true,
        userId: true,
      },
    });
    expect(hasActiveOAuthUserGrantMock).toHaveBeenLastCalledWith({
      clientId: "client-refresh",
      grantId: "trusted-refresh-generation",
      requireGrantBinding: true,
      scopes: ["profile", "offline_access"],
      userId: "user-1",
    });
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
