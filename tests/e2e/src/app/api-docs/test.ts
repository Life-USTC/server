/**
 * E2E tests for /api-docs
 */
import { expect, test } from "@playwright/test";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { assertPageContract } from "../_shared/page-contract";

test.describe("/api-docs", () => {
  test("contract", async ({ page }, testInfo) => {
    await assertPageContract(page, { routePath: "/api-docs", testInfo });
  });

  test("renders swagger container", async ({ page }) => {
    await gotoAndWaitForReady(page, "/api-docs");
    await expect(page.locator("#swagger-ui")).toBeVisible();
  });
});
