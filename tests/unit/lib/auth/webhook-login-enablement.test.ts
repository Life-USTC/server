import { afterEach, expect, it, vi } from "vitest";
import { buildBetterAuthPlugins } from "@/lib/auth/better-auth-plugins";

afterEach(() => vi.unstubAllEnvs());

it("webhook-login.explicit-enablement", () => {
  vi.stubEnv("APP_PUBLIC_ORIGIN", "https://life.example");
  vi.stubEnv("APP_CANONICAL_ORIGIN", "https://life.example");
  for (const [enabled, secret, expected] of [
    ["true", "private-secret", true],
    ["", "private-secret", false],
    ["false", "private-secret", false],
    ["TRUE", "private-secret", false],
    ["true", "", false],
    ["true", "   ", false],
  ] as const) {
    vi.stubEnv("WEBHOOK_LOGIN_ENABLED", enabled);
    vi.stubEnv("WEBHOOK_SECRET", secret);
    const plugins = buildBetterAuthPlugins({
      authEnv: {
        AUTH_OIDC_CLIENT_ID: "id",
        AUTH_OIDC_CLIENT_SECRET: "secret",
      } as never,
      authPublicOrigin: "https://life.example",
      oauthProxySecret: undefined,
      oidcIssuer: "https://idp.example",
    });
    const webhook = plugins.find(
      (plugin) => plugin.id === "life-webhook-login",
    );
    expect(Boolean(webhook)).toBe(expected);
    if (webhook) expect(webhook).toHaveProperty("endpoints.webhookLogin");
  }
});
