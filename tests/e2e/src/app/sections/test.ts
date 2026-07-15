/**
 * E2E tests for /sections — Advanced Section Search
 *
 * ## Data Represented
 * - Sections with course, semester, teachers, credits, campus, capacity
 * - Seed section: DEV_SEED.section (jwId 9902001) for DEV_SEED.course
 *
 * ## UI/UX Elements
 * - Search input with advanced syntax (teacher:, coursecode:, campus:, credits:, etc.)
 * - Search help dialog (?) explaining syntax
 * - Semester filter dropdown (combobox)
 * - Table: Semester, Course Name, Section Code, Teachers, Credits, Capacity, Campus
 * - Clickable rows navigating to /sections/{jwId}
 * - URL-driven Previous / page-number / Next pagination
 * - DataState empty state when no results
 * - Clear filter link
 *
 * ## Edge Cases
 * - SSR output contains search query for SEO
 * - Semester filter updates URL with semesterId param
 * - Advanced search syntax parsed server-side (sort:, order:asc/desc)
 */
import { expect, test } from "@playwright/test";
import { DEV_SEED } from "../../../utils/dev-seed";
import { getSeedSectionSemesterFixture } from "../../../utils/e2e-db";
import { visibleText } from "../../../utils/locators";
import {
  expectNoPageHorizontalOverflow,
  gotoAndWaitForReady,
} from "../../../utils/page-ready";
import { absoluteTestUrl } from "../../../utils/request-url";
import { captureStepScreenshot } from "../../../utils/screenshot";
import { assertPageContract } from "../_shared/page-contract";

test.describe("/sections 班级搜索页", () => {
  test("页面契约", async ({ page }, testInfo) => {
    await assertPageContract(page, { routePath: "/sections", testInfo });
  });

  test("SSR 输出包含搜索查询", async ({ baseURL }) => {
    const response = await fetch(
      absoluteTestUrl(
        `/sections?search=${encodeURIComponent(DEV_SEED.section.code)}`,
        baseURL,
      ),
    );
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('id="main-content"');
    expect(html).toContain(DEV_SEED.section.code);
  });

  test("移动端卡片可点击并导航到详情", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAndWaitForReady(
      page,
      `/sections?search=${encodeURIComponent(DEV_SEED.section.code)}`,
      { testInfo, screenshotLabel: "sections-list" },
    );
    await expectNoPageHorizontalOverflow(page);
    await expect(page.getByTestId("catalog-mobile-filters")).toBeVisible();
    await expect(page.getByTestId("catalog-filter-sidebar")).toBeHidden();
    await expect(page.getByTestId("catalog-results-summary")).toBeVisible();
    await expect(page.getByTestId("catalog-active-filters")).toBeVisible();
    await page.getByRole("button", { name: /筛选|Filters/i }).click();
    const filterSheet = page.getByRole("dialog");
    await expect(filterSheet).toBeVisible();
    await expect(filterSheet.getByLabel(/学期|Semester/i)).toBeVisible();
    await page.keyboard.press("Escape");

    const detailLink = page
      .locator("#main-content a[href^='/sections/']:visible")
      .first();
    await expect(detailLink).toBeVisible();
    const box = await detailLink.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(250);
    expect(box?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(640);
    await captureStepScreenshot(page, testInfo, "sections-mobile-list");
    await detailLink.click();

    await expect(page).toHaveURL(/\/sections\/\d+(?:\?.*)?$/);
    await expect(page.locator("#main-content")).toBeVisible();
    await captureStepScreenshot(page, testInfo, "sections-navigate-detail");
  });

  test("桌面表格在结果列内水平滚动", async ({ page }, testInfo) => {
    for (const width of [1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await gotoAndWaitForReady(page, "/sections");

      const tableContainer = page
        .locator('[data-slot="table-container"]:visible')
        .first();
      await expect(tableContainer).toBeVisible();

      const geometry = await tableContainer.evaluate((node) => {
        const container = node as HTMLElement;
        const results = container.closest("section");
        const table = container.querySelector("table");
        if (!results || !table)
          throw new Error("Sections table geometry missing");

        const containerBox = container.getBoundingClientRect();
        const resultsBox = results.getBoundingClientRect();
        return {
          clientWidth: container.clientWidth,
          containerRight: containerBox.right,
          resultsRight: resultsBox.right,
          scrollWidth: container.scrollWidth,
        };
      });

      expect(geometry.containerRight).toBeLessThanOrEqual(
        geometry.resultsRight + 1,
      );
      expect(geometry.scrollWidth).toBeGreaterThan(geometry.clientWidth);

      await tableContainer.evaluate((node) => {
        const container = node as HTMLElement;
        container.scrollLeft = container.scrollWidth;
      });
      await expect
        .poll(() =>
          tableContainer.evaluate((node) => (node as HTMLElement).scrollLeft),
        )
        .toBeGreaterThan(0);

      const containerBox = await tableContainer.boundingBox();
      const lastColumnBox = await tableContainer
        .locator("thead th")
        .last()
        .boundingBox();
      expect(containerBox).not.toBeNull();
      expect(lastColumnBox).not.toBeNull();
      expect(lastColumnBox?.x ?? 0).toBeGreaterThanOrEqual(
        (containerBox?.x ?? 0) - 1,
      );
      expect(
        (lastColumnBox?.x ?? Number.POSITIVE_INFINITY) +
          (lastColumnBox?.width ?? 0),
      ).toBeLessThanOrEqual(
        (containerBox?.x ?? 0) + (containerBox?.width ?? 0) + 1,
      );
    }

    await captureStepScreenshot(page, testInfo, "sections-table-contained");
  });

  test("搜索帮助与清除", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, "/sections", {
      testInfo,
      screenshotLabel: "sections",
    });

    await page
      .getByRole("button", { name: /高级搜索语法|Advanced Search Syntax/i })
      .first()
      .click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await captureStepScreenshot(page, testInfo, "sections-search-help");
    await sheet
      .getByRole("button", { name: /关闭|Close|Cancel/i })
      .first()
      .click();

    const searchInput = page.getByRole("searchbox");
    await searchInput.fill(DEV_SEED.section.code);
    await page.getByRole("button", { name: /^(搜索|Search)$/i }).click();
    await expect(page).toHaveURL(
      new RegExp(`search=${encodeURIComponent(DEV_SEED.section.code)}`),
    );
    await expect(visibleText(page, DEV_SEED.course.nameEn)).toBeVisible();
    await expect(visibleText(page, DEV_SEED.section.code)).toBeVisible();
    await captureStepScreenshot(page, testInfo, "sections-search-results");

    const clearLink = page.getByRole("link", { name: /清除|Clear/i }).first();
    if ((await clearLink.count()) > 0) {
      await clearLink.click();
      await expect(page).toHaveURL(/\/sections(?:\?.*)?$/);
      await captureStepScreenshot(page, testInfo, "sections-clear");
    }
  });

  test("学期筛选保留种子数据结果", async ({ page }, testInfo) => {
    const filter = await getSeedSectionSemesterFixture(DEV_SEED.section.jwId);
    if (!filter.semesterName) {
      await gotoAndWaitForReady(page, "/sections", {
        testInfo,
        screenshotLabel: "sections",
      });
      await expect(page.locator("#main-content")).toBeVisible();
      return;
    }

    await gotoAndWaitForReady(
      page,
      `/sections?semesterId=${filter.semesterId}`,
      { testInfo, screenshotLabel: "sections-semester" },
    );
    await expect(page).toHaveURL(new RegExp(`semesterId=${filter.semesterId}`));
    await expect(visibleText(page, DEV_SEED.course.nameEn)).toBeVisible();
    await expect(visibleText(page, DEV_SEED.section.code)).toBeVisible();
    await captureStepScreenshot(page, testInfo, "sections-filter-semester");
  });
});
