import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_OAUTH_CLIENT_SCOPES,
  OAUTH_PROVIDER_GRANT_TYPES,
  OAUTH_PROVIDER_SCOPES,
} from "@/lib/oauth/constants";

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
        clientRegistrationAllowedScopes: [...OAUTH_PROVIDER_SCOPES],
      }),
    );
  });
});
