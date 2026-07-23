/**
 * E2E tests for /teachers — Teacher Search Page
 *
 * ## Data Represented
 * - Teachers with code, name (cn/en), department, title, sections
 * - Seed teacher: DEV_SEED.teacher (dynamic id, resolved via search)
 * - Department filter backed by getSeedTeacherDepartmentFixture
 *
 * ## UI/UX Elements
 * - h1: "教师" / "Teachers"
 * - SearchBox with search button and clear button
 * - Department filter dropdown from URL param
 * - Table with teacher name linking to /teachers/[id]
 * - Server-side rendered HTML with search params
 *
 * ## Edge Cases
 * - Teacher IDs are dynamic (no static DEV_SEED.teacher.id)
 * - Department fixture may return null if seed data not loaded
 * - Search and clear buttons may be absent in minimal UI
 */
import { expect, test } from "@playwright/test";
import {
  expectCatalogFilterSheet,
  openCatalogFilterSheet,
} from "../../../utils/catalog-filter-sheet";
import { DEV_SEED } from "../../../utils/dev-seed";
import { getSeedTeacherDepartmentFixture } from "../../../utils/e2e-db";
import { visibleText } from "../../../utils/locators";
import {
  expectNoPageHorizontalOverflow,
  gotoAndWaitForReady,
} from "../../../utils/page-ready";
import { absoluteTestUrl } from "../../../utils/request-url";
import { captureStepScreenshot } from "../../../utils/screenshot";
import { assertPageContract } from "../_shared/page-contract";

test.describe("/catalog/teachers", () => {
  test("页面契约", async ({ page }, testInfo) => {
    await assertPageContract(page, {
      routePath: "/catalog/teachers",
      testInfo,
    });
  });

  test("SSR 输出包含搜索参数", async ({ baseURL }) => {
    const response = await fetch(
      absoluteTestUrl(
        `/catalog/teachers?search=${encodeURIComponent(DEV_SEED.teacher.nameCn)}`,
        baseURL,
      ),
    );
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('id="main-content"');
    expect(html).toContain(DEV_SEED.teacher.nameCn);
  });

  test("移动端卡片可点击并导航到详情", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAndWaitForReady(
      page,
      `/catalog/teachers?search=${encodeURIComponent(DEV_SEED.teacher.nameCn)}`,
      { testInfo, screenshotLabel: "teachers-list" },
    );
    await expectNoPageHorizontalOverflow(page);
    await expect(page.getByTestId("catalog-mobile-filters")).toBeVisible();
    await expect(page.getByTestId("catalog-filter-sidebar")).toHaveCount(0);
    await expect(page.getByTestId("catalog-results-summary")).toBeVisible();
    await expect(page.getByTestId("catalog-active-filters")).toBeVisible();
    await expectCatalogFilterSheet(page, [/院系|Department/i]);

    const detailLink = page
      .locator("#main-content a[href^='/catalog/teachers/']:visible")
      .first();
    await expect(detailLink).toBeVisible();
    const box = await detailLink.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(250);
    expect(box?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(640);
    await captureStepScreenshot(page, testInfo, "teachers-mobile-list");
    await detailLink.click();

    await expect(page).toHaveURL(/\/catalog\/teachers\/\d+(?:\?.*)?$/);
    await expect(page.locator("#main-content")).toBeVisible();
    await captureStepScreenshot(page, testInfo, "teachers-navigate-detail");
  });

  test("280 至 1440 像素通过筛选面板提供教师高级筛选", async ({
    page,
  }, testInfo) => {
    for (const width of [280, 320, 375, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await gotoAndWaitForReady(page, "/catalog/teachers");
      await expectCatalogFilterSheet(page, [/院系|Department/i]);
      await expect(page.locator("vite-error-overlay")).toHaveCount(0);
      if (width === 280 || width === 375) {
        await captureStepScreenshot(
          page,
          testInfo,
          `teachers-filter-sheet-${width}`,
        );
      }
    }
  });

  test("搜索和清除按钮可用", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, "/catalog/teachers", {
      testInfo,
      screenshotLabel: "teachers",
    });

    const searchbox = page.getByRole("searchbox").first();
    await expect(searchbox).toBeVisible();

    await searchbox.fill(DEV_SEED.teacher.nameCn);
    const searchButton = page
      .getByRole("button", { name: /搜索|Search/i })
      .first();
    await expect(searchButton).toBeVisible();
    await searchButton.click();

    await expect(page).toHaveURL(/search=/);

    const clearLink = page.getByRole("link", { name: /清除|Clear/i }).first();
    await expect(clearLink).toBeVisible();
    await clearLink.click();
    await expect(page).not.toHaveURL(/search=/);

    await captureStepScreenshot(page, testInfo, "teachers-search-clear");
  });

  test("院系筛选保留教师结果", async ({ page }, testInfo) => {
    const filter = await getSeedTeacherDepartmentFixture(DEV_SEED.teacher.code);
    if (!filter.departmentName) {
      await gotoAndWaitForReady(page, "/catalog/teachers");
      await expect(page.locator("#main-content")).toBeVisible();
      return;
    }

    await gotoAndWaitForReady(page, "/catalog/teachers", {
      testInfo,
      screenshotLabel: "teachers-department",
    });
    await page.getByRole("searchbox").fill("尚未提交的搜索草稿");
    const filterDialog = await openCatalogFilterSheet(page);
    await filterDialog
      .getByLabel(/院系|Department/i)
      .selectOption(String(filter.departmentId));
    await expect(page).toHaveURL(
      new RegExp(`departmentId=${filter.departmentId}`),
    );
    await expect(page).not.toHaveURL(/search=/);
    await expect(visibleText(page, DEV_SEED.teacher.nameCn)).toBeVisible();
    await captureStepScreenshot(page, testInfo, "teachers-filter-department");
  });
});
