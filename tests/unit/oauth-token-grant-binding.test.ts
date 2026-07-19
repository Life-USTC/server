import { beforeEach, describe, expect, it, vi } from "vitest";
import { OAUTH_GRANT_ID_CLAIM } from "@/lib/oauth/constants";

const {
  accessDeleteManyMock,
  accessFindUniqueMock,
  accessUpdateManyMock,
  decodeJwtMock,
  refreshDeleteManyMock,
  refreshFindUniqueMock,
  refreshUpdateManyMock,
  resolveActiveOAuthUserGrantMock,
} = vi.hoisted(() => ({
  accessDeleteManyMock: vi.fn(),
  accessFindUniqueMock: vi.fn(),
  accessUpdateManyMock: vi.fn(),
  decodeJwtMock: vi.fn(),
  refreshDeleteManyMock: vi.fn(),
  refreshFindUniqueMock: vi.fn(),
  refreshUpdateManyMock: vi.fn(),
  resolveActiveOAuthUserGrantMock: vi.fn(),
}));

vi.mock("jose", () => ({
  decodeJwt: decodeJwtMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    oAuthAccessToken: {
      deleteMany: accessDeleteManyMock,
      findUnique: accessFindUniqueMock,
      updateMany: accessUpdateManyMock,
    },
    oAuthRefreshToken: {
      deleteMany: refreshDeleteManyMock,
      findUnique: refreshFindUniqueMock,
      updateMany: refreshUpdateManyMock,
    },
  },
}));

vi.mock("@/lib/oauth/active-user-grant", () => ({
  resolveActiveOAuthUserGrant: resolveActiveOAuthUserGrantMock,
}));

describe("OAuth access-token grant binding", () => {
  beforeEach(() => {
    accessDeleteManyMock.mockReset();
    accessFindUniqueMock.mockReset();
    accessUpdateManyMock.mockReset();
    decodeJwtMock.mockReset();
    refreshDeleteManyMock.mockReset();
    refreshFindUniqueMock.mockReset();
    refreshUpdateManyMock.mockReset();
    resolveActiveOAuthUserGrantMock.mockReset();
    accessDeleteManyMock.mockResolvedValue({ count: 1 });
    accessUpdateManyMock.mockResolvedValue({ count: 1 });
    refreshDeleteManyMock.mockResolvedValue({ count: 1 });
    refreshUpdateManyMock.mockResolvedValue({ count: 1 });
  });

  it("rejects a delegated JWT without exact grant lineage", async () => {
    decodeJwtMock.mockReturnValue({
      aud: "https://life.example/api/graphql",
      azp: "client-1",
      exp: 1_900_000_000,
      iat: 1_800_000_000,
      scope: "todo:read profile",
      sub: "user-1",
    });
    resolveActiveOAuthUserGrantMock.mockResolvedValue({
      consentId: "consent-1",
      grantId: "grant-1",
      kind: "consent",
    });
    const { bindOAuthAccessTokenToConsent } = await import(
      "@/lib/api/routes/auth-token-grant-binding"
    );

    const response = await bindOAuthAccessTokenToConsent(
      Response.json(
        {
          access_token: "header.payload.signature",
          expires_in: 3600,
          token_type: "Bearer",
        },
        { headers: { "Cache-Control": "no-store" } },
      ),
    );

    expect(resolveActiveOAuthUserGrantMock).toHaveBeenNthCalledWith(1, {
      clientId: "client-1",
      grantId: undefined,
      requireGrantBinding: true,
      scopes: ["todo:read", "profile"],
      userId: "user-1",
    });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "invalid_grant",
    });
  });

  it("keeps a JWT bound to the exact active grant generation", async () => {
    decodeJwtMock.mockReturnValue({
      azp: "client-1",
      [OAUTH_GRANT_ID_CLAIM]: "grant-1",
      scope: "todo:read profile",
      sub: "user-1",
    });
    resolveActiveOAuthUserGrantMock.mockResolvedValue({
      consentId: "consent-1",
      grantId: "grant-1",
      kind: "consent",
    });
    const { bindOAuthAccessTokenToConsent } = await import(
      "@/lib/api/routes/auth-token-grant-binding"
    );
    const original = Response.json({
      access_token: "header.payload.signature",
    });

    expect(await bindOAuthAccessTokenToConsent(original)).toBe(original);
    expect(resolveActiveOAuthUserGrantMock).toHaveBeenCalledWith({
      clientId: "client-1",
      grantId: "grant-1",
      requireGrantBinding: true,
      scopes: ["todo:read", "profile"],
      userId: "user-1",
    });
  });

  it("binds opaque access and refresh rows to the same generation", async () => {
    accessFindUniqueMock.mockResolvedValue({
      clientId: "client-1",
      grantId: null,
      referenceId: "grant-1",
      scopes: ["profile", "offline_access"],
      userId: "user-1",
    });
    refreshFindUniqueMock.mockResolvedValue({
      clientId: "client-1",
      grantId: null,
      referenceId: "grant-1",
      scopes: ["profile", "offline_access"],
      userId: "user-1",
    });
    resolveActiveOAuthUserGrantMock.mockResolvedValue({
      consentId: "consent-1",
      grantId: "grant-1",
      kind: "consent",
    });
    const { bindOAuthAccessTokenToConsent } = await import(
      "@/lib/api/routes/auth-token-grant-binding"
    );
    const response = Response.json({
      access_token: "opaque-access",
      refresh_token: "opaque-refresh",
    });

    expect(await bindOAuthAccessTokenToConsent(response)).toBe(response);
    expect(accessUpdateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { grantId: "grant-1", referenceId: "grant-1" },
      }),
    );
    expect(refreshUpdateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { grantId: "grant-1", referenceId: "grant-1" },
      }),
    );
  });

  it("does not rebind an old refresh lineage after reauthorization", async () => {
    decodeJwtMock.mockReturnValue({
      azp: "client-1",
      [OAUTH_GRANT_ID_CLAIM]: "old-grant",
      scope: "profile offline_access",
      sub: "user-1",
    });
    refreshFindUniqueMock.mockResolvedValue({
      clientId: "client-1",
      grantId: null,
      referenceId: "old-grant",
      scopes: ["profile", "offline_access"],
      userId: "user-1",
    });
    resolveActiveOAuthUserGrantMock.mockResolvedValue(null);
    const { bindOAuthAccessTokenToConsent } = await import(
      "@/lib/api/routes/auth-token-grant-binding"
    );

    const response = await bindOAuthAccessTokenToConsent(
      Response.json({
        access_token: "header.payload.signature",
        refresh_token: "new-refresh",
      }),
    );

    expect(response.status).toBe(400);
    expect(resolveActiveOAuthUserGrantMock).toHaveBeenCalledWith({
      clientId: "client-1",
      grantId: "old-grant",
      requireGrantBinding: true,
      scopes: ["profile", "offline_access"],
      userId: "user-1",
    });
    expect(refreshDeleteManyMock).toHaveBeenCalled();
    expect(refreshUpdateManyMock).not.toHaveBeenCalled();
  });

  it("rejects access scopes broader than the refresh response outcome", async () => {
    decodeJwtMock.mockReturnValue({
      azp: "client-1",
      [OAUTH_GRANT_ID_CLAIM]: "grant-1",
      scope: "profile todo:write",
      sub: "user-1",
    });
    const { bindOAuthAccessTokenToConsent } = await import(
      "@/lib/api/routes/auth-token-grant-binding"
    );

    const response = await bindOAuthAccessTokenToConsent(
      Response.json({
        access_token: "header.payload.signature",
        scope: "profile",
      }),
    );

    expect(response.status).toBe(400);
    expect(resolveActiveOAuthUserGrantMock).not.toHaveBeenCalled();
  });

  it("uses the rotated refresh row as the scope outcome when scope is omitted", async () => {
    decodeJwtMock.mockReturnValue({
      azp: "client-1",
      [OAUTH_GRANT_ID_CLAIM]: "grant-1",
      scope: "profile todo:write",
      sub: "user-1",
    });
    refreshFindUniqueMock.mockResolvedValue({
      clientId: "client-1",
      grantId: "grant-1",
      referenceId: "grant-1",
      scopes: ["profile"],
      userId: "user-1",
    });
    const { bindOAuthAccessTokenToConsent } = await import(
      "@/lib/api/routes/auth-token-grant-binding"
    );

    const response = await bindOAuthAccessTokenToConsent(
      Response.json({
        access_token: "header.payload.signature",
        refresh_token: "rotated-refresh",
      }),
    );

    expect(response.status).toBe(400);
    expect(refreshDeleteManyMock).toHaveBeenCalled();
    expect(resolveActiveOAuthUserGrantMock).not.toHaveBeenCalled();
  });

  it("enforces an explicit refresh downscope when the response scope is omitted", async () => {
    decodeJwtMock.mockReturnValue({
      azp: "client-1",
      [OAUTH_GRANT_ID_CLAIM]: "grant-1",
      scope: "profile todo:write",
      sub: "user-1",
    });
    refreshFindUniqueMock.mockResolvedValue({
      clientId: "client-1",
      grantId: "grant-1",
      referenceId: "grant-1",
      scopes: ["profile", "todo:write"],
      userId: "user-1",
    });
    const { bindOAuthAccessTokenToConsent } = await import(
      "@/lib/api/routes/auth-token-grant-binding"
    );

    const response = await bindOAuthAccessTokenToConsent(
      Response.json({
        access_token: "header.payload.signature",
        refresh_token: "rotated-refresh",
      }),
      ["profile"],
    );

    expect(response.status).toBe(400);
    expect(refreshDeleteManyMock).toHaveBeenCalled();
    expect(resolveActiveOAuthUserGrantMock).not.toHaveBeenCalled();
  });

  it("validates both access and refresh scopes against the active grant", async () => {
    decodeJwtMock.mockReturnValue({
      azp: "client-1",
      [OAUTH_GRANT_ID_CLAIM]: "grant-1",
      scope: "profile",
      sub: "user-1",
    });
    refreshFindUniqueMock.mockResolvedValue({
      clientId: "client-1",
      grantId: "grant-1",
      referenceId: "grant-1",
      scopes: ["profile", "offline_access"],
      userId: "user-1",
    });
    resolveActiveOAuthUserGrantMock.mockResolvedValue({
      consentId: "consent-1",
      grantId: "grant-1",
      kind: "consent",
    });
    const { bindOAuthAccessTokenToConsent } = await import(
      "@/lib/api/routes/auth-token-grant-binding"
    );

    const response = Response.json({
      access_token: "header.payload.signature",
      refresh_token: "rotated-refresh",
      scope: "profile offline_access",
    });
    expect(await bindOAuthAccessTokenToConsent(response)).toBe(response);
    expect(resolveActiveOAuthUserGrantMock).toHaveBeenCalledWith({
      clientId: "client-1",
      grantId: "grant-1",
      requireGrantBinding: true,
      scopes: ["profile", "offline_access"],
      userId: "user-1",
    });
  });

  it("does not issue a JWT when its consent disappeared during exchange", async () => {
    decodeJwtMock.mockReturnValue({
      azp: "client-1",
      scope: "todo:read",
      sub: "user-1",
    });
    resolveActiveOAuthUserGrantMock.mockResolvedValue(null);
    const { bindOAuthAccessTokenToConsent } = await import(
      "@/lib/api/routes/auth-token-grant-binding"
    );

    const response = await bindOAuthAccessTokenToConsent(
      Response.json({ access_token: "header.payload.signature" }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "invalid_grant",
      error_description: "OAuth authorization is no longer active",
    });
  });

  it("leaves an explicitly trusted client JWT unchanged", async () => {
    decodeJwtMock.mockReturnValue({
      azp: "trusted-client",
      scope: "profile",
      sub: "user-1",
    });
    resolveActiveOAuthUserGrantMock.mockResolvedValue({ kind: "trusted" });
    const { bindOAuthAccessTokenToConsent } = await import(
      "@/lib/api/routes/auth-token-grant-binding"
    );
    const trusted = Response.json({
      access_token: "header.payload.signature",
    });

    expect(await bindOAuthAccessTokenToConsent(trusted)).toBe(trusted);
  });
});
