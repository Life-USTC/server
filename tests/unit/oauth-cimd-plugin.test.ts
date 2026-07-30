import { validateCimdMetadata } from "@better-auth/cimd";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("Better Auth CIMD plugin", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("rejects MCP metadata that omits client_name before registration", () => {
    const clientId = "https://client.example/oauth.json";

    expect(
      validateCimdMetadata(clientId, {
        client_id: clientId,
        redirect_uris: ["https://client.example/callback"],
      }),
    ).toEqual({
      error: "client_name must be a non-empty string",
      valid: false,
    });

    expect(
      validateCimdMetadata(clientId, {
        client_id: clientId,
        client_name: "Example MCP Client",
        redirect_uris: ["https://client.example/callback"],
      }),
    ).toMatchObject({ valid: true });
  });

  it("rejects CIMD clients that require DPoP on Bearer-only resources", () => {
    const clientId = "https://client.example/dpop-oauth.json";

    expect(
      validateCimdMetadata(clientId, {
        client_id: clientId,
        client_name: "DPoP-only Client",
        dpop_bound_access_tokens: true,
        redirect_uris: ["https://client.example/callback"],
      }),
    ).toEqual({
      error:
        "DPoP-bound access tokens are not supported by this Bearer-only resource server",
      valid: false,
    });
  });

  it("accepts VS Code grant metadata while requiring the code flow", () => {
    const clientId = "https://vscode.dev/oauth/client-metadata.json";

    expect(
      validateCimdMetadata(clientId, {
        client_id: clientId,
        client_name: "Visual Studio Code",
        redirect_uris: ["http://127.0.0.1:33418"],
        grant_types: [
          "authorization_code",
          "refresh_token",
          "urn:ietf:params:oauth:grant-type:device_code",
        ],
        response_types: ["code", "token"],
      }),
    ).toMatchObject({ valid: true });

    expect(
      validateCimdMetadata(clientId, {
        client_id: clientId,
        client_name: "Device-only client",
        redirect_uris: ["http://127.0.0.1:33418"],
        grant_types: ["urn:ietf:params:oauth:grant-type:device_code"],
      }),
    ).toMatchObject({
      error: 'grant_types must include "authorization_code"',
      valid: false,
    });
  });

  it("advertises CIMD while retaining DCR fallback", async () => {
    vi.stubEnv("APP_PUBLIC_ORIGIN", "https://life.example");
    vi.stubEnv("APP_CANONICAL_ORIGIN", "https://life.example");

    const [
      { betterAuth },
      { oauthProviderAuthServerMetadata },
      { buildBetterAuthPlugins },
    ] = await Promise.all([
      import("better-auth"),
      import("@better-auth/oauth-provider"),
      import("@/lib/auth/better-auth-plugins"),
    ]);
    const plugins = buildBetterAuthPlugins({
      authEnv: {
        AUTH_OIDC_CLIENT_ID: "oidc-client",
        AUTH_OIDC_CLIENT_SECRET: "oidc-secret",
      } as never,
      authPublicOrigin: "https://life.example",
      oauthProxySecret: undefined,
      oidcDiscoveryUrl: "https://idp.example/.well-known/openid-configuration",
      oidcIssuer: "https://idp.example",
    });

    const oauthProviderIndex = plugins.findIndex(
      (plugin) => plugin.id === "oauth-provider",
    );
    const cimdIndex = plugins.findIndex((plugin) => plugin.id === "cimd");
    expect(oauthProviderIndex).toBeGreaterThanOrEqual(0);
    expect(cimdIndex).toBeGreaterThan(oauthProviderIndex);

    const auth = betterAuth({
      baseURL: "https://life.example/api/auth",
      secret: "unit-test-secret-with-at-least-thirty-two-characters",
      plugins: plugins.filter((plugin) =>
        ["jwt", "oauth-provider", "cimd"].includes(plugin.id),
      ),
    });
    const response = await oauthProviderAuthServerMetadata(auth)(
      new Request(
        "https://life.example/.well-known/oauth-authorization-server/api/auth",
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      client_id_metadata_document_supported: true,
      registration_endpoint: "https://life.example/api/auth/oauth2/register",
    });
  });
});
