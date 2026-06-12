/**
 * E2E tests for /e2e/oauth/callback
 */
import { expect, test } from "@playwright/test";
import { gotoAndWaitForReady } from "../../../../../utils/page-ready";
import { assertPageContract } from "../../../_shared/page-contract";

test.describe("/e2e/oauth/callback", () => {
  test("contract", async ({ page }, testInfo) => {
    await assertPageContract(page, {
      routePath: "/e2e/oauth/callback",
      testInfo,
    });
  });

  test("captures callback query payload", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(
      page,
      "/e2e/oauth/callback?code=abc123&state=state-xyz&error=some-error",
      { testInfo, screenshotLabel: "e2e-oauth-callback" },
    );
    await expect(
      page.getByRole("heading", { name: /OAuth E2E Callback/i }),
    ).toBeVisible();
    await expect(page.locator("pre")).toContainText("abc123");
    await expect(page.locator("pre")).toContainText("state-xyz");
    await expect(page.locator("pre")).toContainText("some-error");
  });
});
