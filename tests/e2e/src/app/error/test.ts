/**
 * E2E tests for /error
 */
import { expect } from "@playwright/test";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { test } from "../../../utils/public-worker";
import { assertPageContract } from "../_shared/page-contract";

test.describe("/error 错误页", () => {
  test("页面契约", async ({ page, publicFlow }, testInfo) => {
    await publicFlow.run(async () => {
      await assertPageContract(page, { routePath: "/error", testInfo });
    });
  });

  test("授权被拒绝时显示授权错误信息", async ({
    page,
    publicFlow,
  }, testInfo) => {
    await publicFlow.run(async () => {
      await gotoAndWaitForReady(page, "/error?error=consent_failed", {
        testInfo,
        screenshotLabel: "error-consent-failed",
      });
      await expect(
        page.getByRole("heading", { name: /授权错误|Authorization Error/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: /返回首页|Return home/i }),
      ).toBeVisible();
    });
  });
});
