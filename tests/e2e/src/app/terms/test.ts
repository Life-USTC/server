/**
 * E2E tests for /terms page
 *
 * Static legal page rendering the terms of service from i18n keys.
 */
import { expect } from "@playwright/test";
import {
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../utils/page-ready";
import { test } from "../../../utils/public-worker";
import { assertPageContract } from "../_shared/page-contract";

test.describe("/terms", () => {
  test("页面契约", async ({ page, publicFlow }) => {
    await publicFlow.run(async () => {
      await assertPageContract(page, { routePath: "/terms" });
    });
  });

  test("渲染服务条款及分节", async ({ page, publicFlow }) => {
    await publicFlow.run(async () => {
      await gotoAndWaitForReady(page, "/terms");
      await waitForUiSettled(page);

      await expect(page.locator("#main-content")).toBeVisible();
      await expect(page.locator("h1")).toBeVisible();

      const sections = page.locator("h2");
      await expect(sections.first()).toBeVisible();
      expect(await sections.count()).toBeGreaterThan(0);

      const listItems = page.locator("li");
      expect(await listItems.count()).toBeGreaterThan(0);
    });
  });
});
