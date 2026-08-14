import { describe, expect, it, vi } from "vitest";
import {
  OAUTH_GRANT_ID_CLAIM,
  OAUTH_PROVIDER_GRANT_TYPES,
  OAUTH_REFRESH_TOKEN_EXPIRES_IN_SECONDS,
} from "@/lib/oauth/constants";
import {
  CLIENT_REGISTRATION_ALLOWED_SCOPES,
  OAUTH_PROVIDER_SCOPES,
  PUBLIC_OAUTH_SCOPES,
} from "@/lib/oauth/scope-registry";

const { hasActiveOAuthUserGrantMock, mcpMock, resolveOAuthUserEmailMock } =
  vi.hoisted(() => ({
    hasActiveOAuthUserGrantMock: vi.fn(),
    mcpMock: vi.fn((options) => ({ id: "oauth-provider", options })),
    resolveOAuthUserEmailMock: vi.fn(),
  }));

vi.mock("@better-auth/mcp", () => ({
  mcp: mcpMock,
}));

vi.mock("@/lib/auth/auth-config", () => ({
  allowDebugAuth: () => false,
}));

vi.mock("@/lib/oauth/active-user-grant", () => ({
  hasActiveOAuthUserGrant: hasActiveOAuthUserGrantMock,
}));

vi.mock("@/lib/auth/oauth-user-email-resolve", () => ({
  resolveOAuthUserEmail: (...args: unknown[]) =>
    resolveOAuthUserEmailMock(...args),
}));

vi.mock("@/lib/mcp/urls", () => ({
  getOAuthMcpResourceUrl: () => "https://life.example/api/mcp",
  getOAuthProviderValidAudiences: () => ["https://life.example/api/mcp"],
}));

describe("buildOAuthProviderPlugin", () => {
  it("将提供者限制为用户委托的 OAuth 授权", async () => {
    const { buildOAuthProviderPlugin } = await import(
      "@/lib/auth/better-auth-oauth-provider-plugin"
    );

    buildOAuthProviderPlugin({
      authPublicOrigin: "https://life.example",
    });

    expect(mcpMock).toHaveBeenCalledWith(
      expect.objectContaining({
        grantTypes: [...OAUTH_PROVIDER_GRANT_TYPES],
        loginPage: "https://life.example/account/sign-in",
        refreshTokenReuseInterval: 0,
        refreshTokenExpiresIn: OAUTH_REFRESH_TOKEN_EXPIRES_IN_SECONDS,
        resource: "https://life.example/api/mcp",
        enforcePerClientResources: false,
        cachedResources: new Set(["https://life.example/api/mcp"]),
        resources: [
          {
            allowedScopes: [...OAUTH_PROVIDER_SCOPES],
            dpopBoundAccessTokensRequired: false,
            identifier: "https://life.example/api/mcp",
          },
        ],
      }),
    );
    expect(mcpMock.mock.calls[0]?.[0].grantTypes).not.toContain(
      "client_credentials",
    );
  });

  it("DCR 客户端默认使用公开作用域且不允许公开注册 admin scope", async () => {
    const { buildOAuthProviderPlugin } = await import(
      "@/lib/auth/better-auth-oauth-provider-plugin"
    );

    buildOAuthProviderPlugin({
      authPublicOrigin: "https://life.example",
    });

    expect(mcpMock).toHaveBeenCalledWith(
      expect.objectContaining({
        clientRegistrationDefaultScopes: [...PUBLIC_OAUTH_SCOPES],
        clientRegistrationAllowedScopes: [
          ...CLIENT_REGISTRATION_ALLOWED_SCOPES,
        ],
        scopes: [...OAUTH_PROVIDER_SCOPES],
        advertisedMetadata: expect.objectContaining({
          scopes_supported: [...PUBLIC_OAUTH_SCOPES],
        }),
      }),
    );
    const options = mcpMock.mock.calls[0]?.[0];
    expect(options.clientRegistrationAllowedScopes).not.toContain("admin:read");
    expect(options.clientRegistrationAllowedScopes).not.toContain(
      "admin:write",
    );
    expect(options.scopes).toContain("admin:read");
    expect(options.scopes).toContain("admin:write");
  });

  it("授权、动态注册和发现文档只使用 canonical feature scope", async () => {
    const { buildOAuthProviderPlugin } = await import(
      "@/lib/auth/better-auth-oauth-provider-plugin"
    );

    buildOAuthProviderPlugin({
      authPublicOrigin: "https://life.example",
    });

    const options = mcpMock.mock.calls[0]?.[0];
    expect(options.scopes).not.toContain("rest:read");
    expect(options.scopes).not.toContain("rest:write");
    expect(options.scopes).not.toContain("mcp:tools");
    expect(options.clientRegistrationAllowedScopes).not.toContain("rest:read");
    expect(options.clientRegistrationAllowedScopes).not.toContain("mcp:tools");
    expect(options.advertisedMetadata.scopes_supported).not.toContain(
      "rest:read",
    );
    expect(options.advertisedMetadata.scopes_supported).not.toContain(
      "mcp:tools",
    );
    expect(options.advertisedMetadata.scopes_supported).toContain(
      "workspace.todo:read",
    );
    expect(options.advertisedMetadata.scopes_supported).toContain(
      "workspace.todo:write",
    );
    expect(options.advertisedMetadata.scopes_supported).not.toContain(
      "admin:read",
    );
    expect(options.advertisedMetadata.scopes_supported).not.toContain(
      "admin:write",
    );
    expect(options.advertisedMetadata.scopes_supported).toEqual([
      ...PUBLIC_OAUTH_SCOPES,
    ]);
  });

  it("userinfo rejects a JWT whose exact consent is no longer active", async () => {
    const { buildOAuthProviderPlugin } = await import(
      "@/lib/auth/better-auth-oauth-provider-plugin"
    );
    buildOAuthProviderPlugin({
      authPublicOrigin: "https://life.example",
    });
    const options = mcpMock.mock.calls.at(-1)?.[0];

    hasActiveOAuthUserGrantMock.mockResolvedValueOnce(false);
    await expect(
      options.customUserInfoClaims({
        jwt: {
          azp: "client-1",
          [OAUTH_GRANT_ID_CLAIM]: "grant-1",
        },
        scopes: ["openid", "profile"],
        user: { id: "user-1", username: "alice" },
      }),
    ).rejects.toThrow();
    expect(hasActiveOAuthUserGrantMock).toHaveBeenCalledWith({
      clientId: "client-1",
      grantId: "grant-1",
      requireGrantBinding: true,
      scopes: ["openid", "profile"],
      userId: "user-1",
    });

    hasActiveOAuthUserGrantMock.mockResolvedValueOnce(true);
    await expect(
      options.customUserInfoClaims({
        jwt: {
          azp: "client-1",
          [OAUTH_GRANT_ID_CLAIM]: "grant-1",
        },
        scopes: ["profile"],
        user: { id: "user-1", username: "alice" },
      }),
    ).resolves.toEqual({ preferred_username: "alice" });

    hasActiveOAuthUserGrantMock.mockResolvedValueOnce(true);
    await expect(
      options.customUserInfoClaims({
        jwt: {
          azp: "client-1",
          [OAUTH_GRANT_ID_CLAIM]: "grant-1",
        },
        requestedClaims: ["preferred_username"],
        scopes: ["openid"],
        user: { id: "user-1", username: "alice" },
      }),
    ).resolves.toEqual({ preferred_username: "alice" });
  });

  it("propagates opaque-token lineage and validates its client_id", async () => {
    const { buildOAuthProviderPlugin } = await import(
      "@/lib/auth/better-auth-oauth-provider-plugin"
    );
    buildOAuthProviderPlugin({
      authPublicOrigin: "https://life.example",
    });
    const options = mcpMock.mock.calls.at(-1)?.[0];

    expect(
      options.customAccessTokenClaims({ referenceId: "grant-opaque" }),
    ).toEqual({
      [OAUTH_GRANT_ID_CLAIM]: "grant-opaque",
    });

    hasActiveOAuthUserGrantMock.mockResolvedValueOnce(true);
    await expect(
      options.customUserInfoClaims({
        jwt: {
          client_id: "opaque-client",
          [OAUTH_GRANT_ID_CLAIM]: "grant-opaque",
        },
        scopes: ["profile"],
        user: { id: "user-1", username: "alice" },
      }),
    ).resolves.toEqual({ preferred_username: "alice" });
    expect(hasActiveOAuthUserGrantMock).toHaveBeenLastCalledWith({
      clientId: "opaque-client",
      grantId: "grant-opaque",
      requireGrantBinding: true,
      scopes: ["profile"],
      userId: "user-1",
    });
  });

  it("returns verified GitHub/Google email when available without clearing placeholders", async () => {
    const { buildOAuthProviderPlugin } = await import(
      "@/lib/auth/better-auth-oauth-provider-plugin"
    );
    buildOAuthProviderPlugin({
      authPublicOrigin: "https://life.example",
    });
    const options = mcpMock.mock.calls.at(-1)?.[0];

    hasActiveOAuthUserGrantMock.mockResolvedValueOnce(true);
    resolveOAuthUserEmailMock.mockResolvedValueOnce({
      email: "student@gmail.com",
      emailVerified: true,
      source: "verified-email",
    });

    await expect(
      options.customUserInfoClaims({
        jwt: {
          azp: "client-1",
          [OAUTH_GRANT_ID_CLAIM]: "grant-1",
        },
        scopes: ["openid", "email"],
        user: {
          id: "user-1",
          email: "oidc-1@users.local",
          emailVerified: false,
        },
      }),
    ).resolves.toEqual({
      email: "student@gmail.com",
      email_verified: true,
    });

    hasActiveOAuthUserGrantMock.mockResolvedValueOnce(true);
    resolveOAuthUserEmailMock.mockResolvedValueOnce(null);
    // No custom email claims → Better Auth keeps its base User.email claim.
    await expect(
      options.customUserInfoClaims({
        jwt: {
          azp: "client-1",
          [OAUTH_GRANT_ID_CLAIM]: "grant-1",
        },
        scopes: ["email"],
        user: {
          id: "user-1",
          email: "oidc-1@users.local",
          emailVerified: false,
        },
      }),
    ).resolves.toEqual({});
  });
});
