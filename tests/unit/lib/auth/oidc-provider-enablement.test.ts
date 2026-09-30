import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { expect, it, vi } from "vitest";
import { getAuthEnv } from "@/app-env";
import { buildBetterAuthPlugins } from "@/lib/auth/better-auth-plugins";

for (const [name, clientId, clientSecret, providers] of [
  ["both credentials missing", "", "", []],
  ["client ID only", "configured-client", "", []],
  ["client secret only", "", "configured-secret", []],
  [
    "both credentials configured",
    "configured-client",
    "configured-secret",
    ["oidc"],
  ],
] as const) {
  it(`OIDC registration and sign-in require both credentials: ${name}`, async () => {
    const origin = "https://life.example";
    vi.stubEnv("APP_PUBLIC_ORIGIN", origin);
    vi.stubEnv("APP_CANONICAL_ORIGIN", origin);
    const upstream = vi.fn(() => {
      throw new Error(
        "Authorization setup must not contact the upstream provider",
      );
    });
    vi.stubGlobal("fetch", upstream);
    const plugin = buildBetterAuthPlugins({
      authEnv: getAuthEnv({
        AUTH_OIDC_CLIENT_ID: clientId,
        AUTH_OIDC_CLIENT_SECRET: clientSecret,
      }),
      authPublicOrigin: origin,
      oauthProxySecret: undefined,
      oidcIssuer: "https://idp.example",
    }).find(({ id }) => id === "generic-oauth");
    if (!plugin) throw new Error("Missing generic OAuth plugin");
    const records = { user: [], session: [], account: [], verification: [] };
    const auth = betterAuth({
      baseURL: origin,
      secret: "local-oidc-enablement-test-secret-32-characters",
      database: memoryAdapter(records),
      plugins: [plugin],
      rateLimit: { enabled: false },
      logger: { disabled: true },
    });
    const context = await auth.$context;
    expect(context.socialProviders.map(({ id }) => id)).toEqual(providers);
    const response = await auth.handler(
      new Request(`${origin}/api/auth/sign-in/social`, {
        method: "POST",
        headers: { "content-type": "application/json", origin },
        body: JSON.stringify({
          provider: "oidc",
          callbackURL: `${origin}/workspace`,
          disableRedirect: true,
        }),
      }),
    );
    const body = await response.json();
    if (providers.length === 0) {
      expect(response.status).toBe(404);
      expect(body.code).toBe("PROVIDER_NOT_FOUND");
      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.getSetCookie()).toEqual([]);
      expect(records).toEqual({
        user: [],
        session: [],
        account: [],
        verification: [],
      });
    } else {
      expect(response.status).toBe(200);
      expect(body.redirect).toBe(false);
      const authorization = new URL(body.url);
      expect(authorization.origin).toBe("https://idp.example");
      expect(authorization.pathname).toBe("/authorize/");
      expect(authorization.searchParams.get("client_id")).toBe(
        "configured-client",
      );
      expect(authorization.searchParams.get("redirect_uri")).toBe(
        `${origin}/api/auth/callback/oidc`,
      );
      expect(authorization.searchParams.get("scope")).toBe("openid");
      expect(authorization.searchParams.get("code_challenge_method")).toBe(
        "S256",
      );
      expect(authorization.searchParams.get("code_challenge")).toEqual(
        expect.any(String),
      );
      expect(authorization.searchParams.get("state")).toEqual(
        expect.any(String),
      );
    }
    expect(upstream).not.toHaveBeenCalled();
  });
}
