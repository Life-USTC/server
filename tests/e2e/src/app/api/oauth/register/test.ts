/**
 * E2E tests for OAuth 2.0 provider endpoints
 *
 * Tests the OAuth 2.0 / OpenID Connect infrastructure used for MCP authentication.
 * The actual dynamic client registration endpoint is at /api/auth/oauth2/register.
 *
 * - Canonical well-known discovery endpoints:
 *   - /.well-known/oauth-authorization-server/api/auth → authorization server metadata
 *   - /api/auth/.well-known/openid-configuration → OpenID provider configuration
 *   - /.well-known/openid-configuration/api/auth → RFC 8414 compatibility form for OpenID metadata
 *   - /.well-known/oauth-protected-resource/api/mcp → protected resource metadata
 * - Legacy root aliases redirect to the canonical path-specific locations
 * - Full PKCE authorization code flow:
 *   1. POST /api/auth/oauth2/register → dynamic client registration
 *   2. GET /api/auth/oauth2/authorize → redirect to consent page
 *   3. User grants consent → redirect with authorization code
 *   4. POST /api/auth/oauth2/token → exchange code for access token
 *   5. GET /api/auth/oauth2/userinfo → retrieve user claims
 */
import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import {
  MCP_TOOLS_SCOPE,
  OAUTH_AUTHORIZATION_CODE_GRANT_TYPE,
  OAUTH_CODE_RESPONSE_TYPE,
  OAUTH_EMAIL_SCOPE,
  OAUTH_OPENID_SCOPE,
  OAUTH_PROFILE_SCOPE,
  OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
} from "@/lib/oauth/constants";
import { signInAsDebugUser } from "../../../../../utils/auth";
import { PLAYWRIGHT_BASE_URL } from "../../../../../utils/e2e-db";

function generateCodeChallenge(codeVerifier: string) {
  return createHash("sha256").update(codeVerifier).digest("base64url");
}

const REDIRECT_URI = `${PLAYWRIGHT_BASE_URL}/e2e/oauth/callback`;
const RESOURCE = `${PLAYWRIGHT_BASE_URL}/api/mcp`;
const CODE_VERIFIER =
  "oauth-provider-e2e-verifier-0123456789012345678901234567890123456789";
const LOOPBACK_REDIRECT_URI = "http://127.0.0.1:61000/callback";
const LOOPBACK_LOCALHOST_REDIRECT_URI = "http://localhost:61000/callback";
const DCR_CLIENT_SCOPE = [
  OAUTH_OPENID_SCOPE,
  OAUTH_PROFILE_SCOPE,
  OAUTH_EMAIL_SCOPE,
  MCP_TOOLS_SCOPE,
].join(" ");

test.describe("OAuth provider", () => {
  test("canonical well-known endpoints are exposed and legacy aliases redirect", async ({
    request,
  }) => {
    const [
      authServer,
      openid,
      openidCompatibility,
      protectedResource,
      authServerMcpCompatibility,
      openidMcpCompatibility,
      authServerMcpRelative,
      openidMcpRelative,
      openidOptions,
      authServerAlias,
      openidAlias,
      protectedResourceAlias,
    ] = await Promise.all([
      request.get("/.well-known/oauth-authorization-server/api/auth"),
      request.get("/api/auth/.well-known/openid-configuration"),
      request.get("/.well-known/openid-configuration/api/auth"),
      request.get("/.well-known/oauth-protected-resource/api/mcp"),
      request.get("/.well-known/oauth-authorization-server/api/mcp", {
        maxRedirects: 0,
      }),
      request.get("/.well-known/openid-configuration/api/mcp", {
        maxRedirects: 0,
      }),
      request.get("/api/mcp/.well-known/oauth-authorization-server", {
        maxRedirects: 0,
      }),
      request.get("/api/mcp/.well-known/openid-configuration", {
        maxRedirects: 0,
      }),
      request.fetch("/api/auth/.well-known/openid-configuration", {
        method: "OPTIONS",
      }),
      request.get("/.well-known/oauth-authorization-server", {
        maxRedirects: 0,
      }),
      request.get("/.well-known/openid-configuration", { maxRedirects: 0 }),
      request.get("/.well-known/oauth-protected-resource", {
        maxRedirects: 0,
      }),
    ]);

    expect(authServer.status()).toBe(200);
    expect(openid.status()).toBe(200);
    expect(openidCompatibility.status()).toBe(200);
    expect(protectedResource.status()).toBe(200);
    expect(authServerMcpCompatibility.status()).toBe(307);
    expect(openidMcpCompatibility.status()).toBe(307);
    expect(authServerMcpRelative.status()).toBe(307);
    expect(openidMcpRelative.status()).toBe(307);
    expect(openid.headers()["access-control-allow-origin"]).toBe("*");
    expect(openidCompatibility.headers()["access-control-allow-origin"]).toBe(
      "*",
    );
    expect(authServer.headers()["access-control-allow-origin"]).toBe("*");
    expect(protectedResource.headers()["access-control-allow-origin"]).toBe(
      "*",
    );
    expect(openidOptions.status()).toBe(204);
    expect(openidOptions.headers()["access-control-allow-origin"]).toBe("*");

    expect(authServerAlias.status()).toBe(307);
    expect(new URL(authServerAlias.headers().location ?? "").pathname).toBe(
      "/.well-known/oauth-authorization-server/api/auth",
    );
    expect(authServerAlias.headers()["access-control-allow-origin"]).toBe("*");

    expect(openidAlias.status()).toBe(307);
    expect(new URL(openidAlias.headers().location ?? "").pathname).toBe(
      "/api/auth/.well-known/openid-configuration",
    );
    expect(openidAlias.headers()["access-control-allow-origin"]).toBe("*");

    expect(protectedResourceAlias.status()).toBe(307);
    expect(
      new URL(protectedResourceAlias.headers().location ?? "").pathname,
    ).toBe("/.well-known/oauth-protected-resource/api/mcp");
    expect(
      protectedResourceAlias.headers()["access-control-allow-origin"],
    ).toBe("*");

    expect(
      new URL(authServerMcpCompatibility.headers().location ?? "").pathname,
    ).toBe("/.well-known/oauth-authorization-server/api/auth");
    expect(
      new URL(openidMcpCompatibility.headers().location ?? "").pathname,
    ).toBe("/api/auth/.well-known/openid-configuration");
    expect(
      new URL(authServerMcpRelative.headers().location ?? "").pathname,
    ).toBe("/.well-known/oauth-authorization-server/api/auth");
    expect(new URL(openidMcpRelative.headers().location ?? "").pathname).toBe(
      "/api/auth/.well-known/openid-configuration",
    );
  });

  test("dynamic registration + consent + code exchange + userinfo", async ({
    page,
    request,
  }) => {
    test.setTimeout(60_000);
    // Register a public client (no secret) for PKCE.
    const registrationResponse = await request.post(
      "/api/auth/oauth2/register",
      {
        data: {
          client_name: `e2e-public-${Date.now()}`,
          redirect_uris: [REDIRECT_URI],
          token_endpoint_auth_method: OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
          grant_types: [OAUTH_AUTHORIZATION_CODE_GRANT_TYPE],
          response_types: [OAUTH_CODE_RESPONSE_TYPE],
          scope: DCR_CLIENT_SCOPE,
        },
      },
    );
    expect(registrationResponse.status()).toBe(200);
    const registrationBody = (await registrationResponse.json()) as {
      client_id?: string;
      client_name?: string;
    };
    const clientId = registrationBody.client_id;
    expect(typeof clientId).toBe("string");
    if (typeof clientId !== "string") {
      throw new Error("Missing OAuth client_id");
    }
    expect(registrationBody.client_name).toMatch(/^e2e-public-/);

    await signInAsDebugUser(page, "/");

    // Start authorize flow (will redirect to consent page).
    const authorizeResponse = await page.request.get(
      "/api/auth/oauth2/authorize",
      {
        params: {
          response_type: OAUTH_CODE_RESPONSE_TYPE,
          client_id: clientId,
          redirect_uri: REDIRECT_URI,
          scope: DCR_CLIENT_SCOPE,
          state: "e2e-state",
          prompt: "consent",
          code_challenge: generateCodeChallenge(CODE_VERIFIER),
          code_challenge_method: "S256",
          resource: RESOURCE,
        },
        maxRedirects: 0,
      },
    );
    expect(authorizeResponse.status()).toBe(302);
    const consentLocation = authorizeResponse.headers().location;
    expect(consentLocation).toContain("/oauth/authorize?");

    // Complete consent UI.
    await page.goto(consentLocation);
    await page.waitForLoadState("domcontentloaded");
    const allowButton = page.getByRole("button", {
      name: /allow|允许|授权/i,
    });
    if ((await allowButton.count()) === 0) {
      await page
        .getByRole("button", { name: /Debug User \(Dev\)|调试用户（开发）/i })
        .first()
        .click();
      await page.waitForURL("**/oauth/authorize**");
    }
    await expect(allowButton).toBeVisible();
    await allowButton.click();
    await page.waitForURL("**/e2e/oauth/callback**");

    const callbackUrl = new URL(page.url());
    const code = callbackUrl.searchParams.get("code");
    expect(typeof code).toBe("string");
    if (typeof code !== "string") {
      throw new Error("Missing OAuth authorization code");
    }

    // Exchange code for token.
    const tokenResponse = await request.post("/api/auth/oauth2/token", {
      form: {
        grant_type: OAUTH_AUTHORIZATION_CODE_GRANT_TYPE,
        client_id: clientId,
        code,
        code_verifier: CODE_VERIFIER,
        redirect_uri: REDIRECT_URI,
        resource: RESOURCE,
      },
    });
    expect(tokenResponse.status()).toBe(200);
    const tokenBody = (await tokenResponse.json()) as {
      access_token?: string;
    };
    expect(typeof tokenBody.access_token).toBe("string");

    // Userinfo should return profile claims when openid scope exists.
    const userinfoResponse = await request.get("/api/auth/oauth2/userinfo", {
      headers: { authorization: `Bearer ${tokenBody.access_token}` },
    });
    expect(userinfoResponse.status()).toBe(200);
    const userinfoBody = (await userinfoResponse.json()) as { sub?: string };
    expect(typeof userinfoBody.sub).toBe("string");
  });

  test("loopback authorize accepts localhost alias for a 127.0.0.1 DCR client", async ({
    page,
    request,
  }) => {
    const registrationResponse = await request.post(
      "/api/auth/oauth2/register",
      {
        data: {
          client_name: `e2e-loopback-${Date.now()}`,
          redirect_uris: [LOOPBACK_REDIRECT_URI],
          token_endpoint_auth_method: OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
          grant_types: [OAUTH_AUTHORIZATION_CODE_GRANT_TYPE],
          response_types: [OAUTH_CODE_RESPONSE_TYPE],
          scope: DCR_CLIENT_SCOPE,
          type: "native",
        },
      },
    );
    expect(registrationResponse.status()).toBe(200);
    const registrationBody = (await registrationResponse.json()) as {
      client_id?: string;
    };
    const clientId = registrationBody.client_id;
    expect(typeof clientId).toBe("string");
    if (typeof clientId !== "string") {
      throw new Error("Missing OAuth client_id");
    }

    await signInAsDebugUser(page, "/");

    const authorizeResponse = await page.request.get(
      "/api/auth/oauth2/authorize",
      {
        params: {
          response_type: OAUTH_CODE_RESPONSE_TYPE,
          client_id: clientId,
          redirect_uri: LOOPBACK_LOCALHOST_REDIRECT_URI,
          scope: DCR_CLIENT_SCOPE,
          state: "e2e-loopback-state",
          prompt: "consent",
          code_challenge: generateCodeChallenge(CODE_VERIFIER),
          code_challenge_method: "S256",
        },
        maxRedirects: 0,
      },
    );

    expect(authorizeResponse.status()).toBe(302);
    expect(authorizeResponse.headers().location).toContain("/oauth/authorize?");
  });
});
