/**
 * E2E tests for /signin
 *
 * ## Data Represented (user.yml → sign-in.display.fields)
 * - OAuth provider buttons: GitHub, Google, OIDC/USTC
 * - Error message (if login fails)
 * - Terms and privacy links
 *
 * ## Features
 * - Provider buttons initiate OAuth flows
 * - Debug login button (dev-only) bypasses OAuth
 * - After login: redirected to callbackUrl or home
 *
 * ## Edge Cases
 * - Already authenticated user navigating to /signin redirects away
 * - jwId is NOT displayed
 * - Live USTC/GitHub/Google OAuth round-trips are not exercised in CI; set
 *   `E2E_LIVE_OAUTH=1` locally with real provider credentials to test them.
 */
import { expect, type Page } from "@playwright/test";
import { DEV_SEED } from "../../../utils/dev-seed";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { captureStepScreenshot } from "../../../utils/screenshot";
import { signInThroughDevButton, test } from "../../../utils/signin-fixture";
import { assertPageContract } from "../_shared/page-contract";

async function expectSignedOutAfterMenuClick(page: Page) {
  await page.locator("#app-user-menu").getByRole("button").click();
  await page.getByRole("menuitem", { name: /登出|Sign Out/i }).click();

  await expect(page).toHaveURL(/\/(?:\?.*)?$/);

  const readSessionState = async (path = "/api/auth/get-session") => {
    const response = await page.request.get(path);
    if (!response.ok()) {
      return `status-${response.status()}`;
    }
    const session = (await response.json()) as {
      user?: { id?: string } | null;
    } | null;
    return session?.user?.id ? "signed-in" : "signed-out";
  };

  await expect
    .poll(
      () => readSessionState("/api/auth/get-session?disableCookieCache=true"),
      { timeout: 10_000 },
    )
    .toBe("signed-out");
  await expect.poll(() => readSessionState()).toBe("signed-out");

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#app-user-menu")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: /^(登录|Sign in)$/i }).first(),
  ).toBeVisible();
}

test("/account/sign-in 页面契约", async ({ page }, testInfo) => {
  await assertPageContract(page, { routePath: "/account/sign-in", testInfo });
});

test("/account/sign-in narrow mobile shell uses an accessible compact brand", async ({
  page,
}, testInfo) => {
  for (const width of [280, 375, 390]) {
    await page.setViewportSize({ width, height: 800 });
    await gotoAndWaitForReady(page, "/account/sign-in", {
      testInfo,
      screenshotLabel: `signin-brand-${width}`,
    });

    const brand = page.locator("[data-shell-topbar] [data-shell-brand]");
    if (width < 320) {
      await expect(brand).toBeHidden();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      continue;
    }

    await expect(brand).toBeVisible();
    await expect(brand).toHaveAttribute("aria-label", "Life@USTC");
    await expect(brand).toHaveAttribute("title", "Life@USTC");
    await expect(brand.locator("span")).toHaveClass(/sr-only/);
    await expect(brand.locator("span")).not.toHaveClass(/truncate/);

    const metrics = await brand.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        clientWidth: element.clientWidth,
        right: rect.right,
        viewportWidth: window.innerWidth,
      };
    });
    expect(metrics.clientWidth).toBe(44);
    expect(metrics.right).toBeLessThanOrEqual(metrics.viewportWidth);
  }
});

test("/account/sign-in 320px actions and legal links stay inside the Card", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await gotoAndWaitForReady(page, "/account/sign-in", { testInfo });

  const overflow = await page.locator('[data-slot="card"]').evaluate((card) => {
    const elements = [
      card,
      ...Array.from(card.querySelectorAll<HTMLElement>("form, button, p")),
    ];
    return elements
      .map((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        tag: element.tagName,
      }))
      .filter(({ clientWidth, scrollWidth }) => scrollWidth > clientWidth + 1);
  });

  expect(overflow).toEqual([]);
  await expect(
    page.locator('[data-slot="card"] a[href="/terms"]'),
  ).toBeVisible();
  await expect(
    page.locator('[data-slot="card"] a[href="/privacy"]'),
  ).toBeVisible();
});

test("/account/sign-in 显示所有必填字段", async ({ page }, testInfo) => {
  await gotoAndWaitForReady(page, "/account/sign-in", {
    testInfo,
    screenshotLabel: "signin",
  });

  // OAuth provider buttons (user.yml sign-in.display.fields)
  await expect(
    page.getByRole("button", { name: /USTC/i }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /GitHub/i }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Google/i }).first(),
  ).toBeVisible();

  // Terms and privacy links
  await expect(
    page.getByRole("link", { name: /服务条款|Terms/i }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /隐私政策|Privacy/i }).first(),
  ).toBeVisible();

  await captureStepScreenshot(page, testInfo, "signin/all-fields");
});

test("/account/sign-in 显示账户未关联错误", async ({ page }) => {
  await gotoAndWaitForReady(
    page,
    "/account/sign-in?error=OAuthAccountNotLinked",
  );
  await expect(
    page.getByText(/此账户已关联到其他用户|already linked to another user/i),
  ).toBeVisible();
});

test("/account/sign-in 已登录用户直接返回回调页面", async ({
  page,
  debugUser,
}) => {
  await signInThroughDevButton(page, debugUser);
  await page.goto(
    "/account/sign-in?callbackUrl=%2Faccount%2Fsettings%2Fprofile",
    { waitUntil: "domcontentloaded" },
  );
  await expect(page).toHaveURL(/\/account\/settings\/profile(?:\?.*)?$/);
});

test("/account/sign-in 调试用户按钮可登录", async ({
  page,
  debugUser,
  isolatedWorker,
}, testInfo) => {
  await gotoAndWaitForReady(page, "/account/sign-in", {
    testInfo,
    screenshotLabel: "signin",
  });

  await captureStepScreenshot(page, testInfo, "signin/initial");

  await signInThroughDevButton(page, debugUser);
  await expect(page).toHaveURL(/\/workspace\/overview(?:\?.*)?$/);
  await expect(page.locator("#main-content")).toBeVisible();
  await expect(page.locator("#app-logo")).toBeVisible();
  await expect(page.locator("#app-user-menu")).toBeVisible();
  expect(
    await isolatedWorker.database.owner.session.count({
      where: { userId: debugUser.id },
    }),
  ).toBe(1);
  await captureStepScreenshot(page, testInfo, "signin/after-login");
});

test("/account/sign-in 调试用户可登出", async ({
  page,
  debugUser,
  isolatedWorker,
}, testInfo) => {
  await signInThroughDevButton(page, debugUser);

  await expectSignedOutAfterMenuClick(page);

  expect(
    await isolatedWorker.database.owner.session.count({
      where: { userId: debugUser.id },
    }),
  ).toBe(0);
  await captureStepScreenshot(page, testInfo, "signin/after-sign-out");
});

test("/account/sign-in 调试管理员可登出", async ({
  page,
  adminUser,
  isolatedWorker,
}, testInfo) => {
  await signInThroughDevButton(page, adminUser);

  await expectSignedOutAfterMenuClick(page);

  expect(
    await isolatedWorker.database.owner.session.count({
      where: { userId: adminUser.id },
    }),
  ).toBe(0);
  await captureStepScreenshot(page, testInfo, "signin/admin-after-sign-out");
});

test("user.post-login-redirect", async ({ page, debugUser }) => {
  for (const callback of [
    "/catalog/sections?search=COMP#results",
    "https://attacker.example/",
    "//attacker.example/",
    "/\\attacker.example/",
    "/%2f%2fattacker.example/",
  ]) {
    await page.context().clearCookies();
    await gotoAndWaitForReady(
      page,
      `/account/sign-in?callbackUrl=${encodeURIComponent(callback)}`,
    );
    await page
      .getByRole("button", { name: /Debug User \(Dev\)|调试用户（开发）/i })
      .click();
    await expect(page).toHaveURL(
      callback.startsWith("/catalog/")
        ? /\/catalog\/sections\?search=COMP#results$/
        : /\/workspace\/overview$/,
    );
    const response = await page.request.get(
      "/api/auth/get-session?disableCookieCache=true",
    );
    expect(response.status()).toBe(200);
    const session = await response.json();
    expect(session.user.username).toBe(DEV_SEED.debugUsername);
    expect(session.user.id).toBe(debugUser.id);
  }
});
