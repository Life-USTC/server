/**
 * E2E tests for /guides/markdown-support page
 *
 * Static documentation page showcasing Markdown features supported in comments.
 */
import { expect, test } from "@playwright/test";
import {
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../../utils/page-ready";
import { assertPageContract } from "../../_shared/page-contract";

test.describe("/guides/markdown-support Markdown 支持页", () => {
  test("页面契约", async ({ page }, testInfo) => {
    await assertPageContract(page, {
      routePath: "/guides/markdown-support",
      testInfo,
    });
  });

  test("渲染 Markdown 指南，包含代码块与表格", async ({ page }) => {
    await gotoAndWaitForReady(page, "/guides/markdown-support", {
      waitUntil: "load",
    });
    await waitForUiSettled(page);

    await expect(page.locator("#main-content")).toBeVisible();
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("pre").first()).toContainText("**Bold**");

    // Should contain a table
    await expect(page.locator("table").first()).toBeVisible();
  });
});
