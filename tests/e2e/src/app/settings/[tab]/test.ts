/**
 * E2E tests for settings route variants (`/settings/<tab>`).
 */
import { expect, test } from "@playwright/test";
import {
  expectRequiresSignIn,
  signInAsDebugUser,
} from "../../../../utils/auth";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";

test("/settings 别名路由需要登录", async ({ page }, testInfo) => {
  await expectRequiresSignIn(page, "/settings/profile");
  await captureStepScreenshot(page, testInfo, "settings-profile-unauth");
});

test("/settings/profile 别名路由生效", async ({ page }, testInfo) => {
  await signInAsDebugUser(page, "/settings/profile");
  await gotoAndWaitForReady(page, "/settings/profile", {
    testInfo,
    screenshotLabel: "settings-profile-alias",
  });

  await expect(page).toHaveURL(/\/settings(?:\/profile)?(?:[/?#].*)?$/);
  await expect(page.locator("input#name")).toBeVisible();
  await captureStepScreenshot(page, testInfo, "settings-profile");
});

test("legacy query settings tabs 的 GET/HEAD 永久跳转到语义分区", async ({
  page,
}) => {
  for (const [tab, path] of [
    ["profile", "/settings/profile"],
    ["accounts", "/settings/accounts"],
    ["content", "/settings/content"],
    ["danger", "/settings/danger"],
    ["preferences", "/settings/preferences"],
    ["appearance", "/settings/preferences"],
    ["language", "/settings/preferences"],
  ] as const) {
    for (const method of ["GET", "HEAD"]) {
      const response = await page.request.fetch(
        `/settings?tab=${tab}&message=Success`,
        { maxRedirects: 0, method },
      );

      expect(response.status()).toBe(308);
      expect(response.headers().location).toBe(`${path}?message=Success`);
    }
  }
});

test("/settings 无效别名返回 404", async ({ page }) => {
  await signInAsDebugUser(page, "/settings/profile");
  await gotoAndWaitForReady(page, "/settings/not-a-tab", {
    expectMainContent: false,
  });

  await expect(page.locator("h1")).toHaveText("404");
});
