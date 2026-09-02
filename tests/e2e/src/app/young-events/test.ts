/**
 * E2E tests for /catalog/young-events — 第二课堂活动列表
 *
 * ## Data Represented
 * - Signup events from young.ustc.edu.cn with name, category, event time,
 *   signup window, capacity, and registration status
 * - Seed events: DEV_SEED.youngEvent (active) + dev-scenario-young-event-ended
 *
 * ## UI/UX Elements
 * - Search input (searchbox) with submit and clear buttons
 * - Signup status and category selects (native comboboxes)
 * - Desktop table / mobile item list with links to /catalog/young-events/{youngId}
 * - URL-driven pagination
 * - Empty state when no events match
 *
 * ## Edge Cases
 * - SSR output contains the search query for SEO
 * - Non-matching search shows the empty state instead of an error
 */
import { expect, test } from "@playwright/test";
import { DEV_SEED } from "../../../utils/dev-seed";
import { visibleText } from "../../../utils/locators";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { absoluteTestUrl } from "../../../utils/request-url";
import { assertPageContract } from "../_shared/page-contract";

test.describe("/catalog/young-events 第二课堂活动", () => {
  test("页面契约", async ({ page }, testInfo) => {
    await assertPageContract(page, {
      routePath: "/catalog/young-events",
      testInfo,
    });
  });

  test("SSR 输出包含搜索查询", async ({ baseURL }) => {
    const response = await fetch(
      absoluteTestUrl(
        `/catalog/young-events?search=${encodeURIComponent(DEV_SEED.youngEvent.name)}`,
        baseURL,
      ),
    );
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('id="main-content"');
    expect(html).toContain(DEV_SEED.youngEvent.name);
  });

  test("搜索、报名状态筛选与清除按钮", async ({ page }) => {
    await gotoAndWaitForReady(page, "/catalog/young-events");
    await expect(
      page
        .getByRole("link", { name: new RegExp(DEV_SEED.youngEvent.name) })
        .first(),
    ).toBeVisible();

    const searchbox = page.getByRole("searchbox");
    await searchbox.fill(DEV_SEED.youngEvent.name);
    await page.getByRole("button", { name: /^(?:搜索|Search)$/i }).click();
    await page.waitForURL(/[?&]search=/);
    await expect(
      visibleText(page, DEV_SEED.youngEvent.name).first(),
    ).toBeVisible();

    await searchbox.fill("");
    await page
      .getByRole("combobox", { name: /报名状态|Signup status/i })
      .selectOption("false");
    await page.getByRole("button", { name: /^(?:搜索|Search)$/i }).click();
    await page.waitForURL(/active=false/);
    await expect(
      page.getByRole("link", { name: /已结束活动/ }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", {
        name: new RegExp(DEV_SEED.youngEvent.name),
      }),
    ).toHaveCount(0);

    await page.getByRole("link", { name: /^(?:清除|Clear)$/i }).click();
    await page.waitForURL(/\/catalog\/young-events$/);
    await expect(
      page
        .getByRole("link", { name: new RegExp(DEV_SEED.youngEvent.name) })
        .first(),
    ).toBeVisible();
  });

  test("无匹配活动时显示明确空状态", async ({ page }) => {
    await gotoAndWaitForReady(
      page,
      "/catalog/young-events?search=e2e-no-matching-young-event-7f3c9a",
    );

    await expect(page.getByText(/未找到活动|No events found/i)).toBeVisible();
    await expect(
      page.locator("#main-content a[href^='/catalog/young-events/']"),
    ).toHaveCount(0);
  });
});
