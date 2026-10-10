/**
 * E2E tests for OAuth 2.0 provider endpoints
 *
 * Tests the OAuth 2.0 / OpenID Connect infrastructure used for MCP authentication.
 * The actual dynamic client registration endpoint is at /api/auth/oauth2/register.
 *
 * - Canonical well-known discovery endpoints:
 *   - /.well-known/oauth-authorization-server/api/auth → authorization server metadata
 *   - /api/auth/.well-known/openid-configuration → OpenID provider configuration
 *   - /.well-known/openid-configuration/api/auth → RFC 8414 path-aware OpenID metadata
 *   - /.well-known/oauth-protected-resource/api/mcp → protected resource metadata
 * - Discovery paths are derived from the configured issuer/resource; extra root and MCP-relative aliases return 404
 * - Full PKCE authorization code flow:
 *   1. POST /api/auth/oauth2/register → dynamic client registration
 *   2. GET /api/auth/oauth2/authorize → redirect to consent page
 *   3. User grants consent → redirect with authorization code
 *   4. POST /api/auth/oauth2/token → exchange code for access token
 *   5. GET /api/auth/oauth2/userinfo → retrieve user claims
 */
import { expect } from "@playwright/test";
import {
  OAUTH_AUTHORIZATION_CODE_GRANT_TYPE,
  OAUTH_CODE_RESPONSE_TYPE,
  OAUTH_DEVICE_CODE_GRANT_TYPE,
  OAUTH_EMAIL_SCOPE,
  OAUTH_OPENID_SCOPE,
  OAUTH_PROFILE_SCOPE,
  OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
  restReadScope,
  restWriteScope,
} from "@/lib/oauth/constants";
import { sha256Base64Url } from "../../../../../../shared/crypto";
import { test } from "../../../../../utils/owned-worker";
import { test as isolatedTest } from "../../mcp/_fixture";

async function generateCodeChallenge(codeVerifier: string) {
  return sha256Base64Url(codeVerifier);
}

const CODE_VERIFIER =
  "oauth-provider-e2e-verifier-0123456789012345678901234567890123456789";
const LOOPBACK_REDIRECT_URI = "http://127.0.0.1:61000/callback";
const LOOPBACK_LOCALHOST_REDIRECT_URI = "http://localhost:61000/callback";
const DCR_CLIENT_SCOPE = [
  OAUTH_OPENID_SCOPE,
  OAUTH_PROFILE_SCOPE,
  OAUTH_EMAIL_SCOPE,
  restReadScope("account.profile"),
  restReadScope("workspace.todo"),
  restWriteScope("workspace.todo"),
].join(" ");

test.describe("OAuth 提供者", () => {
  test.describe.configure({ mode: "parallel" });
  test("标准 issuer/resource 发现地址可读且额外别名不存在", {
    tag: "@OAuth/OAuth",
  }, async ({ run, request }) => {
    await run(async () => {
      for (const path of [
        "/.well-known/oauth-authorization-server/api/auth",
        "/api/auth/.well-known/openid-configuration",
        "/.well-known/openid-configuration/api/auth",
        "/.well-known/oauth-protected-resource/api/mcp",
        "/.well-known/oauth-protected-resource/api/graphql",
      ]) {
        const response = await request.get(path);
        expect(response.status()).toBe(200);
        expect(response.headers()["access-control-allow-origin"]).toBe("*");
      }
      const head = await request.head(
        "/.well-known/oauth-protected-resource/api/mcp",
      );
      expect(head.status()).toBe(200);
      expect(await head.body()).toHaveLength(0);
      for (const path of [
        "/.well-known/oauth-authorization-server",
        "/.well-known/openid-configuration",
        "/.well-known/oauth-protected-resource",
        "/.well-known/oauth-authorization-server/api/mcp",
        "/.well-known/openid-configuration/api/mcp",
        "/api/mcp/.well-known/oauth-authorization-server",
        "/api/mcp/.well-known/openid-configuration",
      ]) {
        expect((await request.get(path, { maxRedirects: 0 })).status()).toBe(
          404,
        );
      }
    });
  });

  isolatedTest(
    "动态注册 + 授权同意 + 授权码交换 + userinfo",
    { tag: "@OAuth/OAuth" },
    async ({ isolatedWorker, page, calendarProtocolRun }) => {
      await calendarProtocolRun(async ({ request }) => {
        const REDIRECT_URI = `${isolatedWorker.origin}/e2e/oauth/callback`;
        const RESOURCE = `${isolatedWorker.origin}/api/mcp`;
        test.setTimeout(60_000);
        // Register a public client (no secret) for PKCE.
        const registrationResponse = await request.post(
          "/api/auth/oauth2/register",
          {
            data: {
              application_type: "native",
              client_name: `e2e-public-${Date.now()}`,
              redirect_uris: [REDIRECT_URI],
              token_endpoint_auth_method: OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
              grant_types: [OAUTH_AUTHORIZATION_CODE_GRANT_TYPE],
              response_types: [OAUTH_CODE_RESPONSE_TYPE],
              scope: DCR_CLIENT_SCOPE,
            },
          },
        );
        expect(registrationResponse.status()).toBe(201);
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

        const actor = await isolatedWorker.createActor();
        await page.context().addCookies([actor.cookie]);

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
              code_challenge: await generateCodeChallenge(CODE_VERIFIER),
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
        const userinfoResponse = await request.get(
          "/api/auth/oauth2/userinfo",
          {
            headers: { authorization: `Bearer ${tokenBody.access_token}` },
          },
        );
        expect(userinfoResponse.status()).toBe(200);
        const userinfoBody = (await userinfoResponse.json()) as {
          sub?: string;
        };
        expect(typeof userinfoBody.sub).toBe("string");
        expect(userinfoBody.sub).toBe(actor.id);
        return {
          async verifyTransport({ effects }) {
            expect(
              effects.requests
                .filter(({ value }) => !["GET", "HEAD"].includes(value.method))
                .map(({ value, result }) => [value.method, value.path, result]),
            ).toEqual([
              ["POST", "/api/auth/oauth2/register", 201],
              ["POST", "/oauth/authorize", 200],
              ["POST", "/api/auth/oauth2/token", 200],
            ]);
          },
          async verifyState() {
            const db = isolatedWorker.database.owner;
            expect(await db.oAuthClient.count()).toBe(1);
            expect(await db.user.count()).toBe(1);
            expect(await db.deviceCode.count()).toBe(0);
            expect(await db.oAuthAccessToken.count()).toBe(0);
            expect(await db.oAuthRefreshToken.count()).toBe(0);
            await expect.poll(() => db.auditLog.count()).toBe(1);
            expect(
              (await db.auditLog.findMany({ select: { action: true } }))
                .map((row) => row.action)
                .sort(),
            ).toEqual(["oauth_authorization_grant"]);
            expect(await db.oAuthGrantUsageDaily.findMany()).toEqual([]);
            expect(
              await db.oAuthClient.findMany({
                select: {
                  clientId: true,
                  name: true,
                  redirectUris: true,
                  grantTypes: true,
                },
              }),
            ).toEqual([
              {
                clientId,
                name: registrationBody.client_name,
                redirectUris: [REDIRECT_URI],
                grantTypes: [OAUTH_AUTHORIZATION_CODE_GRANT_TYPE],
              },
            ]);
            expect(
              await db.oAuthConsent.findMany({
                select: {
                  clientId: true,
                  userId: true,
                  grantId: true,
                  scopes: true,
                  resources: true,
                  requestedUserInfoClaims: true,
                },
              }),
            ).toEqual([
              {
                clientId,
                userId: actor.id,
                grantId: expect.any(String),
                scopes: DCR_CLIENT_SCOPE.split(" "),
                resources: [RESOURCE],
                requestedUserInfoClaims: [],
              },
            ]);
          },
        };
      });
    },
  );

  isolatedTest(
    "动态注册接受无 redirect URI 的纯 device 客户端",
    { tag: "@OAuth/OAuth" },
    async ({ isolatedWorker, calendarProtocolRun }) => {
      await calendarProtocolRun(async ({ request }) => {
        const registrationResponse = await request.post(
          "/api/auth/oauth2/register",
          {
            data: {
              client_name: `e2e-device-${Date.now()}`,
              token_endpoint_auth_method: OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
              grant_types: [OAUTH_DEVICE_CODE_GRANT_TYPE],
              scope: `${OAUTH_OPENID_SCOPE} ${OAUTH_PROFILE_SCOPE}`,
            },
          },
        );

        expect(registrationResponse.status()).toBe(201);
        const registrationBody = (await registrationResponse.json()) as {
          client_id?: string;
          grant_types?: string[];
          redirect_uris?: string[];
        };
        expect(typeof registrationBody.client_id).toBe("string");
        expect(registrationBody.grant_types).toEqual([
          OAUTH_DEVICE_CODE_GRANT_TYPE,
        ]);
        expect(registrationBody.redirect_uris).toEqual([]);
        expect(
          await isolatedWorker.database.owner.oAuthClient.findUniqueOrThrow({
            where: { clientId: registrationBody.client_id },
          }),
        ).toMatchObject({
          grantTypes: [OAUTH_DEVICE_CODE_GRANT_TYPE],
          redirectUris: [],
        });
        return {
          async verifyTransport({ effects }) {
            expect(
              effects.requests
                .filter(({ value }) => !["GET", "HEAD"].includes(value.method))
                .map(({ value, result }) => [value.method, value.path, result]),
            ).toEqual([["POST", "/api/auth/oauth2/register", 201]]);
          },
          async verifyState() {
            const db = isolatedWorker.database.owner;
            expect(await db.oAuthClient.count()).toBe(1);
            expect(await db.user.count()).toBe(0);
            expect(await db.deviceCode.count()).toBe(0);
            expect(await db.oAuthAccessToken.count()).toBe(0);
            expect(await db.oAuthRefreshToken.count()).toBe(0);
            await expect.poll(() => db.auditLog.count()).toBe(0);
            expect(
              (await db.auditLog.findMany({ select: { action: true } }))
                .map((row) => row.action)
                .sort(),
            ).toEqual([]);
            expect(await db.oAuthGrantUsageDaily.findMany()).toEqual([]);
            expect(await db.oAuthConsent.findMany()).toEqual([]);
            expect(
              await db.oAuthClient.findMany({
                select: {
                  clientId: true,
                  grantTypes: true,
                  redirectUris: true,
                },
              }),
            ).toEqual([
              {
                clientId: registrationBody.client_id,
                grantTypes: [OAUTH_DEVICE_CODE_GRANT_TYPE],
                redirectUris: [],
              },
            ]);
          },
        };
      });
    },
  );

  isolatedTest(
    "Bearer-only 资源服务器拒绝强制 DPoP 的动态注册",
    { tag: "@OAuth/OAuth" },
    async ({ isolatedWorker, calendarProtocolRun }) => {
      await calendarProtocolRun(async ({ request }) => {
        const REDIRECT_URI = `${isolatedWorker.origin}/e2e/oauth/callback`;
        const response = await request.post("/api/auth/oauth2/register", {
          data: {
            client_name: `e2e-dpop-only-${Date.now()}`,
            dpop_bound_access_tokens: true,
            redirect_uris: [REDIRECT_URI],
            token_endpoint_auth_method: OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
          },
        });

        expect(response.status()).toBe(400);
        await expect(response.json()).resolves.toEqual({
          error: "invalid_client_metadata",
          error_description:
            "DPoP-bound access tokens are not supported by this Bearer-only resource server",
        });
        expect(await isolatedWorker.database.owner.oAuthClient.count()).toBe(0);
        return {
          async verifyTransport({ effects }) {
            expect(
              effects.requests
                .filter(({ value }) => !["GET", "HEAD"].includes(value.method))
                .map(({ value, result }) => [value.method, value.path, result]),
            ).toEqual([["POST", "/api/auth/oauth2/register", 400]]);
          },
          async verifyState() {
            const db = isolatedWorker.database.owner;
            expect(await db.oAuthClient.count()).toBe(0);
            expect(await db.user.count()).toBe(0);
            expect(await db.deviceCode.count()).toBe(0);
            expect(await db.oAuthAccessToken.count()).toBe(0);
            expect(await db.oAuthRefreshToken.count()).toBe(0);
            await expect.poll(() => db.auditLog.count()).toBe(0);
            expect(
              (await db.auditLog.findMany({ select: { action: true } }))
                .map((row) => row.action)
                .sort(),
            ).toEqual([]);
            expect(await db.oAuthGrantUsageDaily.findMany()).toEqual([]);
            expect(await db.oAuthConsent.findMany()).toEqual([]);
          },
        };
      });
    },
  );

  isolatedTest(
    "loopback 授权拒绝替换已注册的 127.0.0.1 主机",
    { tag: "@OAuth/OAuth" },
    async ({ isolatedWorker, page, calendarProtocolRun }) => {
      await calendarProtocolRun(async ({ request }) => {
        const registrationResponse = await request.post(
          "/api/auth/oauth2/register",
          {
            data: {
              application_type: "native",
              client_name: `e2e-loopback-${Date.now()}`,
              redirect_uris: [LOOPBACK_REDIRECT_URI],
              token_endpoint_auth_method: OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
              grant_types: [OAUTH_AUTHORIZATION_CODE_GRANT_TYPE],
              response_types: [OAUTH_CODE_RESPONSE_TYPE],
              scope: DCR_CLIENT_SCOPE,
            },
          },
        );
        expect(registrationResponse.status()).toBe(201);
        const registrationBody = (await registrationResponse.json()) as {
          client_id?: string;
        };
        const clientId = registrationBody.client_id;
        expect(typeof clientId).toBe("string");
        if (typeof clientId !== "string") {
          throw new Error("Missing OAuth client_id");
        }

        const actor = await isolatedWorker.createActor();
        await page.context().addCookies([actor.cookie]);

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
              code_challenge: await generateCodeChallenge(CODE_VERIFIER),
              code_challenge_method: "S256",
            },
            maxRedirects: 0,
          },
        );

        expect(authorizeResponse.status()).toBe(302);
        expect(authorizeResponse.headers().location).toContain(
          "error=invalid_redirect",
        );
        return {
          async verifyTransport({ effects }) {
            expect(
              effects.requests
                .filter(({ value }) => !["GET", "HEAD"].includes(value.method))
                .map(({ value, result }) => [value.method, value.path, result]),
            ).toEqual([["POST", "/api/auth/oauth2/register", 201]]);
          },
          async verifyState() {
            const db = isolatedWorker.database.owner;
            expect(await db.oAuthClient.count()).toBe(1);
            expect(await db.user.count()).toBe(1);
            expect(await db.deviceCode.count()).toBe(0);
            expect(await db.oAuthAccessToken.count()).toBe(0);
            expect(await db.oAuthRefreshToken.count()).toBe(0);
            await expect.poll(() => db.auditLog.count()).toBe(0);
            expect(
              (await db.auditLog.findMany({ select: { action: true } }))
                .map((row) => row.action)
                .sort(),
            ).toEqual([]);
            expect(await db.oAuthGrantUsageDaily.findMany()).toEqual([]);
            expect(await db.oAuthConsent.findMany()).toEqual([]);
            expect(
              await db.oAuthClient.findMany({
                select: { clientId: true, redirectUris: true },
              }),
            ).toEqual([{ clientId, redirectUris: [LOOPBACK_REDIRECT_URI] }]);
          },
        };
      });
    },
  );
});
