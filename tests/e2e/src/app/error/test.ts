/**
 * E2E tests for /error
 */
import { expect, test } from "@playwright/test";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { assertPageContract } from "../_shared/page-contract";

test.describe("/error", () => {
  test("contract", async ({ page }, testInfo) => {
    await assertPageContract(page, { routePath: "/error", testInfo });
  });

  test("displays authorization error message for consent failures", async ({
    page,
  }, testInfo) => {
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
