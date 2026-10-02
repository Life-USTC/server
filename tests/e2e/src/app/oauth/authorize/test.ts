import { type APIRequestContext, expect } from "@playwright/test";
import { sha256Base64Url } from "../../../../../shared/crypto";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { assertPageContract } from "../../_shared/page-contract";
import { test } from "./authorize-fixture";

async function generateCodeChallenge(codeVerifier: string) {
  return sha256Base64Url(codeVerifier);
}

const OAUTH_E2E_CODE_VERIFIER =
  "oauth-e2e-browser-verifier-0123456789012345678901234567890123456789";
const OAUTH_E2E_PKCE = {
  code_challenge: await generateCodeChallenge(OAUTH_E2E_CODE_VERIFIER),
  code_challenge_method: "S256",
} as const;

async function registerPublicClient(
  request: APIRequestContext,
  redirectUri: string,
) {
  const response = await request.post("/api/auth/oauth2/register", {
    data: {
      application_type: "native",
      client_name: `oauth-authorize-e2e-${crypto.randomUUID()}`,
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

test("/oauth/authorize 未登录时重定向到登录页", async ({
  oauthRun,
  page,
  request,
  redirectUri,
}) => {
  await oauthRun(null, async () => {
    const clientId = await registerPublicClient(request, redirectUri);

    await gotoAndWaitForReady(
      page,
      buildAuthorizeApiUrl({
        ...OAUTH_E2E_PKCE,
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "openid profile",
        state: "redirect-state",
        prompt: "consent",
      }),
      { expectMainContent: false },
    );

    await expect(page).toHaveURL(/\/account\/sign-in\?/);
  });
});

test("/oauth/authorize 登录后恢复原授权请求", async ({
  oauthRun,
  page,
  request,
  redirectUri,
  debugUser,
}) => {
  await oauthRun({ kind: "sign-in", state: "resume-state" }, async () => {
    const clientId = await registerPublicClient(request, redirectUri);

    await gotoAndWaitForReady(
      page,
      buildAuthorizeApiUrl({
        ...OAUTH_E2E_PKCE,
        client_id: clientId,
        redirect_uri: redirectUri,
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
    await expect(
      page.getByRole("button", { name: /允许|Allow/i }),
    ).toBeVisible();
    const session = await page.request.get("/api/auth/get-session");
    expect(session.status()).toBe(200);
    expect((await session.json()).user.id).toBe(debugUser);
    expect(new URL(page.url()).searchParams.get("state")).toBe("resume-state");
  });
});

test("/oauth/authorize 无效客户端展示错误", async ({
  oauthRun,
  page,
  actor: _actor,
  redirectUri,
}) => {
  await oauthRun(null, async () => {
    const response = await page.request.get(
      buildAuthorizeApiUrl({
        ...OAUTH_E2E_PKCE,
        client_id: "missing-client",
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "openid profile",
        state: "invalid-client-state",
        prompt: "consent",
      }),
      { maxRedirects: 0 },
    );

    expect(response.status()).toBe(302);
    const errorUrl = new URL(response.headers().location, redirectUri);
    expect(errorUrl.origin).toBe(new URL(redirectUri).origin);
    expect(errorUrl.pathname).toBe("/api/auth/error");
    expect(errorUrl.searchParams.get("error")).toBe("invalid_client");
    const errorPage = await page.goto(errorUrl.href);
    expect(errorPage?.status()).toBe(200);
  });
});

test("/oauth/authorize 拒绝授权时带 error 回跳", async ({
  oauthRun,
  page,
  request,
  isolatedWorker,
  actor: _actor,
  redirectUri,
}) => {
  await oauthRun(
    { kind: "consent", state: "deny-state", decision: "deny", loopback: false },
    async () => {
      const clientId = await registerPublicClient(request, redirectUri);

      const authorizeResponse = await page.request.get(
        buildAuthorizeApiUrl({
          ...OAUTH_E2E_PKCE,
          client_id: clientId,
          redirect_uri: redirectUri,
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
      await expect(
        page.getByRole("button", { name: /允许|Allow/i }),
      ).toBeVisible();

      await page.getByRole("button", { name: /拒绝|Deny/i }).click();
      await expect(page).toHaveURL(/\/e2e\/oauth\/callback\?/);

      const redirected = new URL(page.url());
      expect(redirected.searchParams.get("error")).toBe("access_denied");
      expect(redirected.searchParams.get("state")).toBe("deny-state");
      expect(await isolatedWorker.database.owner.oAuthConsent.count()).toBe(0);
      expect(await isolatedWorker.database.owner.oAuthAccessToken.count()).toBe(
        0,
      );
      expect(
        await isolatedWorker.database.owner.oAuthRefreshToken.count(),
      ).toBe(0);
    },
  );
});

test("oauth.user-consent-framing", async ({
  oauthRun,
  page,
  request,
  actor,
  redirectUri,
  isolatedWorker,
}) => {
  let releaseConsentRequest = () => {};
  const consentRequestGate = new Promise<void>((resolve) => {
    releaseConsentRequest = resolve;
  });
  await oauthRun(
    {
      kind: "consent",
      state: "allow-state",
      decision: "allow",
      loopback: false,
    },
    async () => {
      const clientId = await registerPublicClient(request, redirectUri);

      const authorizeResponse = await page.request.get(
        buildAuthorizeApiUrl({
          ...OAUTH_E2E_PKCE,
          client_id: clientId,
          redirect_uri: redirectUri,
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
      await expect(
        page.getByRole("button", { name: /允许|Allow/i }),
      ).toBeVisible();

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
      const allowButton = page.getByRole("button", { name: /允许|Allow/i });
      const denyButton = page.getByRole("button", { name: /拒绝|Deny/i });
      const allowClick = allowButton.click();
      try {
        await expect(allowButton).toBeDisabled();
        await expect(denyButton).toBeDisabled();
      } finally {
        releaseConsentRequest();
        await allowClick;
      }
      await expect(page).toHaveURL(/\/e2e\/oauth\/callback\?/);

      const redirected = new URL(page.url());
      const code = redirected.searchParams.get("code");
      expect(typeof code).toBe("string");
      expect(redirected.searchParams.get("state")).toBe("allow-state");

      const persisted =
        await isolatedWorker.database.owner.oAuthConsent.findFirstOrThrow({
          where: { clientId, userId: actor },
          select: { scopes: true },
        });
      expect(persisted.scopes).toEqual(["openid", "profile"]);
      if (!code) throw new Error("Expected consent authorization code");
      const exchanged = await request.post("/api/auth/oauth2/token", {
        form: {
          client_id: clientId,
          code,
          code_verifier: OAUTH_E2E_CODE_VERIFIER,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        },
      });
      expect(exchanged.status()).toBe(200);
      expect((await exchanged.json()).scope.split(" ")).toEqual([
        "openid",
        "profile",
      ]);
    },
    { wait: consentRequestGate, release: () => releaseConsentRequest() },
  );
});

test("页面契约", async ({ oauthRun, page }) => {
  await oauthRun(null, async () => {
    await assertPageContract(page, { routePath: "/oauth/authorize" });
  });
});

test("user.oauth-consent-loopback-continuation", async ({
  oauthRun,
  page,
  request,
  actor: _actor,
  isolatedWorker,
}) => {
  await oauthRun(
    {
      kind: "consent",
      state: "loopback-原样+state",
      decision: "allow",
      loopback: true,
    },
    async () => {
      const callback = new URL("/e2e/oauth/callback", isolatedWorker.origin);
      callback.hostname = "127.0.0.1";
      const redirectUri = callback.href;
      const clientId = await registerPublicClient(request, redirectUri);
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
        new URL("/api/auth/oauth2/token", isolatedWorker.origin).href,
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
    },
  );
});

test("oauth.auth-page-clarity", async ({
  oauthRun,
  page,
  actor: _actor,
  isolatedWorker,
}) => {
  await oauthRun(null, async () => {
    const marker = crypto.randomUUID();
    const clientId = `https://client.example/${marker}/metadata.json`;
    const clientName = `Desktop calendar ${marker.slice(0, 8)}`;
    const redirectUri = "http://127.0.0.1:61000/callback";
    await isolatedWorker.database.owner.oAuthClient.create({
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
    });
    for (const locale of ["en-us", "zh-cn"]) {
      await page
        .context()
        .addCookies([
          { name: "NEXT_LOCALE", value: locale, url: isolatedWorker.origin },
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
      }
    }
  });
});
