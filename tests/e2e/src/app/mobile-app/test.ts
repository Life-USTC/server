import { expect, test } from "@playwright/test";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { captureStepScreenshot } from "../../../utils/screenshot";
import { assertPageContract } from "../_shared/page-contract";

test("/mobile-app 页面契约", async ({ page }, testInfo) => {
  await assertPageContract(page, { routePath: "/mobile-app", testInfo });
});

test("/mobile-app 展示下载入口并可返回公开仪表盘", async ({
  page,
}, testInfo) => {
  await gotoAndWaitForReady(page, "/mobile-app", {
    testInfo,
    screenshotLabel: "mobile-app",
  });

  await expect(page.locator("#app-logo")).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: /Life@USTC.*App Store|在 App Store 下载 Life@USTC/i,
    }),
  ).toBeVisible();
  await expect(page.locator('a[href="/"]').first()).toBeVisible();
  await captureStepScreenshot(page, testInfo, "mobile-app-intro");
});
