import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from "@playwright/test";
import { sha256Base64Url } from "../../../../../shared/crypto";
import { signInAsDebugUser } from "../../../../utils/auth";
import { PLAYWRIGHT_BASE_URL } from "../../../../utils/e2e-db";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";

async function generateCodeChallenge(codeVerifier: string) {
  return sha256Base64Url(codeVerifier);
}

const OAUTH_E2E_CODE_VERIFIER =
  "oauth-e2e-browser-verifier-0123456789012345678901234567890123456789";
const OAUTH_E2E_PKCE = {
  code_challenge: await generateCodeChallenge(OAUTH_E2E_CODE_VERIFIER),
  code_challenge_method: "S256",
} as const;

const REDIRECT_URI = `${PLAYWRIGHT_BASE_URL}/e2e/oauth/callback`;

async function registerPublicClient(request: APIRequestContext) {
  const response = await request.post("/api/auth/oauth2/register", {
    data: {
      client_name: `oauth-authorize-e2e-${Date.now()}`,
      redirect_uris: [REDIRECT_URI],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code"],
      response_types: ["code"],
      scope: "openid profile",
    },
  });
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { client_id?: string };
  expect(typeof body.client_id).toBe("string");
  return body.client_id as string;
}

function buildAuthorizeApiUrl(params: Record<string, string>) {
  return `/api/auth/oauth2/authorize?${new URLSearchParams(params).toString()}`;
}

async function resumeConsentIfSignInPage(page: Page) {
  const allowButton = page.getByRole("button", { name: /允许|Allow/i });
  const debugSignInButton = page
    .getByRole("button", {
      name: /Sign in with Debug User \(Dev\)|调试用户（开发）/i,
    })
    .first();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const visibleTarget = await Promise.race([
      allowButton
        .waitFor({ state: "visible", timeout: attempt === 0 ? 5_000 : 1_500 })
        .then(() => "allow" as const)
        .catch(() => null),
      debugSignInButton
        .waitFor({ state: "visible", timeout: attempt === 0 ? 5_000 : 1_500 })
        .then(() => "signin" as const)
        .catch(() => null),
    ]);

    if (visibleTarget === "allow") {
      return;
    }
    if (visibleTarget === "signin") {
      await debugSignInButton.click();
      await page.waitForURL(/\/oauth\/authorize\?/);
    }
  }

  await allowButton.waitFor({ state: "visible" });
}

test("/oauth/authorize 未登录时重定向到登录页", async ({ page }, testInfo) => {
  const clientId = await registerPublicClient(page.request);

  await gotoAndWaitForReady(
    page,
    buildAuthorizeApiUrl({
      ...OAUTH_E2E_PKCE,
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: "openid profile",
      state: "redirect-state",
      prompt: "consent",
    }),
    { expectMainContent: false },
  );

  await expect(page).toHaveURL(/\/account\/sign-in\?/);
  await captureStepScreenshot(page, testInfo, "oauth-authorize-redirect");
});

test("/oauth/authorize 登录后恢复原授权请求", async ({ page }, testInfo) => {
  const clientId = await registerPublicClient(page.request);

  await gotoAndWaitForReady(
    page,
    buildAuthorizeApiUrl({
      ...OAUTH_E2E_PKCE,
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: "openid profile",
      state: "resume-state",
      prompt: "consent",
    }),
    { expectMainContent: false },
  );

  await expect(page).toHaveURL(/\/account\/sign-in\?/);
  await page
    .getByRole("button", { name: /Debug User \(Dev\)|调试用户（开发）/i })
    .first()
    .click();
  await expect(page).toHaveURL(/\/oauth\/authorize\?/);
  await expect(page.getByRole("button", { name: /允许|Allow/i })).toBeVisible();
  await captureStepScreenshot(page, testInfo, "oauth-authorize-resumed");
});

test("/oauth/authorize 无效客户端展示错误", async ({ page }, testInfo) => {
  await signInAsDebugUser(page, "/");

  const response = await page.request.get(
    buildAuthorizeApiUrl({
      ...OAUTH_E2E_PKCE,
      client_id: "missing-client",
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: "openid profile",
      state: "invalid-client-state",
      prompt: "consent",
    }),
    { maxRedirects: 0 },
  );

  expect([302, 400, 401]).toContain(response.status());
  await captureStepScreenshot(page, testInfo, "oauth-authorize-invalid-client");
});

test("/oauth/authorize 拒绝授权时带 error 回跳", async ({ page }, testInfo) => {
  const clientId = await registerPublicClient(page.request);
  await signInAsDebugUser(page, "/");

  const authorizeResponse = await page.request.get(
    buildAuthorizeApiUrl({
      ...OAUTH_E2E_PKCE,
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: "openid profile",
      state: "deny-state",
      prompt: "consent",
    }),
    { maxRedirects: 0 },
  );
  expect(authorizeResponse.status()).toBe(302);
  const consentLocation = authorizeResponse.headers().location;
  expect(consentLocation).toContain("/oauth/authorize?");

  await gotoAndWaitForReady(page, consentLocation, { waitUntil: "load" });
  await resumeConsentIfSignInPage(page);

  await page.getByRole("button", { name: /拒绝|Deny/i }).click();
  await expect(page).toHaveURL(/\/e2e\/oauth\/callback\?/);

  const redirected = new URL(page.url());
  expect(redirected.searchParams.get("error")).toBe("access_denied");
  expect(redirected.searchParams.get("state")).toBe("deny-state");
  await captureStepScreenshot(page, testInfo, "oauth-authorize-denied");
});

test("/oauth/authorize 允许授权时带 code 回跳", async ({ page }, testInfo) => {
  const clientId = await registerPublicClient(page.request);
  await signInAsDebugUser(page, "/");

  const authorizeResponse = await page.request.get(
    buildAuthorizeApiUrl({
      ...OAUTH_E2E_PKCE,
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: "openid profile",
      state: "allow-state",
      prompt: "consent",
    }),
    { maxRedirects: 0 },
  );
  expect(authorizeResponse.status()).toBe(302);
  const consentLocation = authorizeResponse.headers().location;
  expect(consentLocation).toContain("/oauth/authorize?");

  await gotoAndWaitForReady(page, consentLocation, { waitUntil: "load" });
  await resumeConsentIfSignInPage(page);

  await page.getByRole("button", { name: /允许|Allow/i }).click();
  await expect(page).toHaveURL(/\/e2e\/oauth\/callback\?/);

  const redirected = new URL(page.url());
  const code = redirected.searchParams.get("code");
  expect(typeof code).toBe("string");
  expect(redirected.searchParams.get("state")).toBe("allow-state");

  await captureStepScreenshot(page, testInfo, "oauth-authorize-allowed");
});
