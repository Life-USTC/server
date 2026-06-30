import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_OAUTH_CLIENT_SCOPES,
  OAUTH_PROVIDER_GRANT_TYPES,
} from "@/lib/oauth/constants";
import {
  CLIENT_REGISTRATION_ALLOWED_SCOPES,
  OAUTH_SCOPES,
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

  it("DCR 客户端默认使用 profile 作用域并保留 REST 与 MCP 作用域可请求", async () => {
    const { buildOAuthProviderPlugin } = await import(
      "@/lib/auth/better-auth-oauth-provider-plugin"
    );

    buildOAuthProviderPlugin({
      authPublicOrigin: "https://life.example",
    });

    expect(oauthProviderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        clientRegistrationDefaultScopes: [...DEFAULT_OAUTH_CLIENT_SCOPES],
        clientRegistrationAllowedScopes: [...CLIENT_REGISTRATION_ALLOWED_SCOPES],
        scopes: [...CLIENT_REGISTRATION_ALLOWED_SCOPES],
        advertisedMetadata: expect.objectContaining({
          scopes_supported: [...OAUTH_SCOPES],
        }),
      }),
    );
  });

  it("授权与动态注册容忍旧版 coarse scope，但发现文档只公布 feature scope", async () => {
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
    expect(options.advertisedMetadata.scopes_supported).toEqual([
      ...OAUTH_SCOPES,
    ]);
  });
});
