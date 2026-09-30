/**
 * E2E tests for /e2e/oauth/callback
 */
import { expect } from "@playwright/test";
import { gotoAndWaitForReady } from "../../../../../utils/page-ready";
import { test } from "../../../../../utils/public-worker";
import { assertPageContract } from "../../../_shared/page-contract";

test.describe("/e2e/oauth/callback 回调页", () => {
  test("页面契约", async ({ page, publicFlow }, testInfo) => {
    await publicFlow.run(async () => {
      await assertPageContract(page, {
        routePath: "/e2e/oauth/callback",
        testInfo,
      });
    });
  });

  test("捕获回调查询参数", async ({ page, publicFlow }, testInfo) => {
    await publicFlow.run(async () => {
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
});
