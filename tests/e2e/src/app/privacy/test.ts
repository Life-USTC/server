/**
 * E2E tests for /privacy page
 *
 * Static legal page rendering the privacy policy from i18n keys.
 */
import { expect, test } from "@playwright/test";
import {
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../utils/page-ready";
import { assertPageContract } from "../_shared/page-contract";

test.describe("/privacy 隐私政策页", () => {
  test("页面契约", async ({ page }, testInfo) => {
    await assertPageContract(page, { routePath: "/privacy", testInfo });
  });

  test("渲染带章节的隐私政策", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, "/privacy", {
      testInfo,
      screenshotLabel: "privacy",
    });
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

test.describe("/privacy 无 JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("SSR 保留完整政策正文", async ({ page }) => {
    await page.goto("/privacy");

    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("h2").first()).toBeVisible();
    await expect(page.locator("li").first()).toBeVisible();
  });
});
