import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from "@playwright/test";
import { sha256Base64Url } from "../../../../../shared/crypto";
import { signInAsDebugUser } from "../../../../utils/auth";
import { PLAYWRIGHT_BASE_URL } from "../../../../utils/e2e-db";
import { withE2ePrisma } from "../../../../utils/e2e-db/prisma";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";
import { assertPageContract } from "../../_shared/page-contract";

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

async function registerPublicClient(
  request: APIRequestContext,
  redirectUri = REDIRECT_URI,
) {
  const response = await request.post("/api/auth/oauth2/register", {
    data: {
      application_type: "native",
      client_name: `oauth-authorize-e2e-${Date.now()}`,
      redirect_uris: [redirectUri],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code"],
      response_types: ["code"],
      scope: "openid profile",
    },
  });
  expect(response.status()).toBe(201);
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

test("oauth.user-consent-framing", async ({ page, request }, testInfo) => {
  const clientId = await registerPublicClient(page.request);
  await signInAsDebugUser(page, "/");

  const authorizeResponse = await page.request.get(
    buildAuthorizeApiUrl({
      ...OAUTH_E2E_PKCE,
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: "openid profile email",
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

  await expect(
    page.getByText(
      /正在请求访问您的账户|is requesting access to your account/i,
    ),
  ).toBeVisible();
  const emailPermission = page.getByRole("checkbox", {
    name: /查看您的邮箱地址|View your email address/i,
  });
  const profilePermission = page.getByRole("checkbox", {
    name: /查看您的个人资料|View your profile information/i,
  });
  await expect(emailPermission).toBeChecked();
  await expect(profilePermission).toBeChecked();
  await emailPermission.uncheck();
  await expect(emailPermission).not.toBeChecked();
  await expect(profilePermission).toBeChecked();
  await captureStepScreenshot(page, testInfo, "oauth-consent-subset");

  let releaseConsentRequest = () => {};
  const consentRequestGate = new Promise<void>((resolve) => {
    releaseConsentRequest = resolve;
  });
  await page.route(
    (url) => url.pathname === "/oauth/authorize" && url.search === "?/consent",
    async (route) => {
      await consentRequestGate;
      await route.continue();
    },
  );
  const allowButton = page.getByRole("button", { name: /允许|Allow/i });
  const denyButton = page.getByRole("button", { name: /拒绝|Deny/i });
  const allowClick = allowButton.click();
  await expect(allowButton).toBeDisabled();
  await expect(denyButton).toBeDisabled();
  releaseConsentRequest();
  await allowClick;
  await expect(page).toHaveURL(/\/e2e\/oauth\/callback\?/);

  const redirected = new URL(page.url());
  const code = redirected.searchParams.get("code");
  expect(typeof code).toBe("string");
  expect(redirected.searchParams.get("state")).toBe("allow-state");

  const persisted = await withE2ePrisma((prisma) =>
    prisma.oAuthConsent.findFirstOrThrow({
      where: { clientId },
      select: { scopes: true },
    }),
  );
  expect(persisted.scopes).toEqual(["openid", "profile"]);
  const exchanged = await request.post("/api/auth/oauth2/token", {
    form: {
      client_id: clientId,
      code: code!,
      code_verifier: OAUTH_E2E_CODE_VERIFIER,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    },
  });
  expect(exchanged.status()).toBe(200);
  expect((await exchanged.json()).scope.split(" ")).toEqual([
    "openid",
    "profile",
  ]);
  await captureStepScreenshot(page, testInfo, "oauth-authorize-allowed");
});

test("页面契约", async ({ page }, testInfo) => {
  await assertPageContract(page, { routePath: "/oauth/authorize", testInfo });
});

test("user.oauth-consent-loopback-continuation", async ({ page }) => {
  const callback = new URL("/e2e/oauth/callback", PLAYWRIGHT_BASE_URL);
  callback.hostname = "127.0.0.1";
  const redirectUri = callback.href;
  const clientId = await registerPublicClient(page.request, redirectUri);
  await signInAsDebugUser(page, "/workspace/overview");
  const parameters = {
    ...OAUTH_E2E_PKCE,
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid profile",
    state: "loopback-原样+state",
    prompt: "consent",
  };
  await gotoAndWaitForReady(page, buildAuthorizeApiUrl(parameters));
  expect(new URL(page.url()).hostname).toBe("localhost");
  const consent = new URL(page.url());
  for (const [key, value] of Object.entries(parameters))
    expect(consent.searchParams.get(key), key).toBe(value);
  await page.getByRole("button", { name: /允许|Allow/i }).click();
  await expect(page).toHaveURL(
    (url) =>
      url.hostname === "127.0.0.1" &&
      url.pathname === callback.pathname &&
      url.searchParams.has("code"),
  );
  const completed = new URL(page.url());
  expect(completed.searchParams.get("state")).toBe(parameters.state);
  const response = await page.request.post(
    new URL("/api/auth/oauth2/token", PLAYWRIGHT_BASE_URL).href,
    {
      headers: { cookie: "" },
      form: {
        client_id: clientId,
        grant_type: "authorization_code",
        code: completed.searchParams.get("code") ?? "",
        code_verifier: OAUTH_E2E_CODE_VERIFIER,
        redirect_uri: redirectUri,
      },
    },
  );
  expect(response.status()).toBe(200);
  expect((await response.json()).access_token).toEqual(expect.any(String));
});

test("oauth.auth-page-clarity", async ({ page }, testInfo) => {
  const marker = crypto.randomUUID();
  const clientId = `https://client.example/${marker}/metadata.json`;
  const clientName = `Desktop calendar ${marker.slice(0, 8)}`;
  const redirectUri = "http://127.0.0.1:61000/callback";
  await withE2ePrisma((prisma) =>
    prisma.oAuthClient.create({
      data: {
        clientId,
        name: clientName,
        applicationType: "native",
        tokenEndpointAuthMethod: "none",
        redirectUris: [redirectUri],
        scopes: ["openid", "profile", "email"],
        requirePKCE: true,
        grantTypes: ["authorization_code"],
        responseTypes: ["code"],
      },
    }),
  );
  try {
    await signInAsDebugUser(page, "/");
    for (const locale of ["en-us", "zh-cn"]) {
      await page
        .context()
        .addCookies([
          { name: "NEXT_LOCALE", value: locale, url: PLAYWRIGHT_BASE_URL },
        ]);
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 900 });
        const query = new URLSearchParams({
          client_id: clientId,
          redirect_uri: redirectUri,
          scope: "openid profile email",
        });
        const response = await gotoAndWaitForReady(
          page,
          `/oauth/authorize?${query}`,
          {
            browserHealth: {},
            expectMeaningfulContent: true,
            expectNoHorizontalOverflow: true,
            uiQuality: {},
          },
        );
        expect(response?.status()).toBe(200);
        await expect(page).toHaveURL(/\/oauth\/authorize\?/);
        await expect(page).toHaveTitle(/Authorize|授权/);
        await expect(page.locator("html")).toHaveAttribute(
          "lang",
          locale === "en-us" ? /en/i : /zh/i,
        );
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expect(page.getByText(clientName, { exact: true })).toBeVisible();
        await expect(
          page.getByText(
            /Client host: client\.example|客户端主机: client\.example|客户端主机：client\.example/,
          ),
        ).toBeVisible();
        await expect(
          page.getByText(
            /Redirect host: 127\.0\.0\.1:61000|回调主机: 127\.0\.0\.1:61000|回调主机：127\.0\.0\.1:61000/,
          ),
        ).toBeVisible();
        await expect(
          page.getByText(
            /This callback returns to an application on your device|此回调将返回您设备上的本地应用/,
          ),
        ).toBeVisible();
        await expect(
          page.getByRole("checkbox", {
            name: /View your email address|查看您的邮箱地址/i,
          }),
        ).toBeVisible();
        await expect(
          page.getByRole("checkbox", {
            name: /View your profile information|查看您的个人资料/i,
          }),
        ).toBeVisible();
        await expect(
          page.getByRole("checkbox", {
            name: /Verify your identity|验证您的身份/i,
          }),
        ).toBeVisible();
        await expect(
          page.getByRole("button", { name: /Allow|允许/i }),
        ).toBeEnabled();
        await expect(
          page.getByRole("button", { name: /Deny|拒绝/i }),
        ).toBeEnabled();
        await captureStepScreenshot(
          page,
          testInfo,
          `oauth-clarity-${locale}-${width}`,
        );
      }
    }
  } finally {
    await withE2ePrisma((prisma) =>
      prisma.oAuthClient.deleteMany({ where: { clientId } }),
    );
  }
});
