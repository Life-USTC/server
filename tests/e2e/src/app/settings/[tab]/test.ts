/**
 * E2E tests for settings route variants (`/account/settings/<tab>`).
 */
import { expect, test } from "@playwright/test";
import {
  expectRequiresSignIn,
  signInAsDebugUser,
} from "../../../../utils/auth";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";

test("/account/settings 别名路由需要登录", async ({ page }, testInfo) => {
  await expectRequiresSignIn(page, "/account/settings/profile");
  await captureStepScreenshot(page, testInfo, "settings-profile-unauth");
});

test("/account/settings/profile 别名路由生效", async ({ page }, testInfo) => {
  await signInAsDebugUser(page, "/account/settings/profile");
  await gotoAndWaitForReady(page, "/account/settings/profile", {
    testInfo,
    screenshotLabel: "settings-profile-alias",
  });

  await expect(page).toHaveURL(
    /\/account\/settings(?:\/profile)?(?:[/?#].*)?$/,
  );
  await expect(page.locator("input#name")).toBeVisible();
  await captureStepScreenshot(page, testInfo, "settings-profile");
});

test("legacy query settings tabs 的 GET/HEAD 永久跳转到语义分区", async ({
  page,
}) => {
  for (const [tab, path] of [
    ["profile", "/account/settings/profile"],
    ["accounts", "/account/settings/accounts"],
    ["content", "/account/settings/content"],
    ["danger", "/account/settings/danger"],
    ["preferences", "/account/settings/preferences"],
    ["appearance", "/account/settings/preferences"],
    ["language", "/account/settings/preferences"],
  ] as const) {
    for (const method of ["GET", "HEAD"]) {
      const response = await page.request.fetch(
        `/account/settings?tab=${tab}&message=Success`,
        { maxRedirects: 0, method },
      );

      expect(response.status()).toBe(308);
      expect(response.headers().location).toBe(`${path}?message=Success`);
    }
  }
});

test("/account/settings 无效别名返回 404", async ({ page }) => {
  await signInAsDebugUser(page, "/account/settings/profile");
  await gotoAndWaitForReady(page, "/account/settings/not-a-tab", {
    expectMainContent: false,
  });

  await expect(page.locator("h1")).toHaveText("404");
});
