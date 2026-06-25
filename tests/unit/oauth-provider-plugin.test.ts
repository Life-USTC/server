import { describe, expect, it, vi } from "vitest";
import { OAUTH_PROVIDER_GRANT_TYPES } from "@/lib/oauth/constants";

const { oauthProviderMock } = vi.hoisted(() => ({
  oauthProviderMock: vi.fn((options) => ({ id: "oauth-provider", options })),
}));

vi.mock("@better-auth/oauth-provider", () => ({
  oauthProvider: oauthProviderMock,
}));

vi.mock("@/lib/auth/auth-config", () => ({
  allowDebugAuth: false,
}));

vi.mock("@/lib/mcp/urls", () => ({
  getOAuthProviderValidAudiences: () => ["https://life.example/api/mcp"],
}));

describe("buildOAuthProviderPlugin", () => {
  it("restricts the provider to user-delegated OAuth grants", async () => {
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
});
