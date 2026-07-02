import { describe, expect, it, vi } from "vitest";
import { OAUTH_PROVIDER_GRANT_TYPES } from "@/lib/oauth/constants";
import {
  CLIENT_REGISTRATION_ALLOWED_SCOPES,
  OAUTH_PROVIDER_SCOPES,
  PUBLIC_OAUTH_SCOPES,
} from "@/lib/oauth/scope-registry";

const { oauthProviderMock } = vi.hoisted(() => ({
  oauthProviderMock: vi.fn((options) => ({ id: "oauth-provider", options })),
}));

vi.mock("@better-auth/oauth-provider", () => ({
  oauthProvider: oauthProviderMock,
}));

vi.mock("@/lib/auth/auth-config", () => ({
  allowDebugAuth: () => false,
}));

vi.mock("@/lib/mcp/urls", () => ({
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

    expect(oauthProviderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        grantTypes: [...OAUTH_PROVIDER_GRANT_TYPES],
      }),
    );
    expect(oauthProviderMock.mock.calls[0]?.[0].grantTypes).not.toContain(
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

    expect(oauthProviderMock).toHaveBeenCalledWith(
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
    const options = oauthProviderMock.mock.calls[0]?.[0];
    expect(options.clientRegistrationAllowedScopes).not.toContain("admin:read");
    expect(options.clientRegistrationAllowedScopes).not.toContain(
      "admin:write",
    );
    expect(options.scopes).toContain("admin:read");
    expect(options.scopes).toContain("admin:write");
  });

  it("授权与动态注册容忍旧版 coarse scope，但发现文档只公布公开 feature scope", async () => {
    const { buildOAuthProviderPlugin } = await import(
      "@/lib/auth/better-auth-oauth-provider-plugin"
    );

    buildOAuthProviderPlugin({
      authPublicOrigin: "https://life.example",
    });

    const options = oauthProviderMock.mock.calls[0]?.[0];
    expect(options.scopes).toContain("rest:read");
    expect(options.scopes).toContain("rest:write");
    expect(options.scopes).toContain("mcp:tools");
    expect(options.clientRegistrationAllowedScopes).toContain("rest:read");
    expect(options.clientRegistrationAllowedScopes).toContain("mcp:tools");
    expect(options.advertisedMetadata.scopes_supported).not.toContain(
      "rest:read",
    );
    expect(options.advertisedMetadata.scopes_supported).not.toContain(
      "mcp:tools",
    );
    expect(options.advertisedMetadata.scopes_supported).toContain("todo:read");
    expect(options.advertisedMetadata.scopes_supported).toContain("todo:write");
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
});
