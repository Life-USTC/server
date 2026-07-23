/**
 * E2E tests for /courses — Paginated Course Catalog
 *
 * ## Data Represented
 * - Courses with nameCn/nameEn, code, educationLevel, category, classType
 * - Seed course: DEV_SEED.course (jwId 9901001)
 *
 * ## UI/UX Elements
 * - Search input (searchbox) with search/clear buttons
 * - Filter dropdowns: education level, category, class type
 * - Table with columns: Course Name, Code, Education Level, Category, Class Type
 * - Clickable rows navigating to /courses/{jwId}
 * - URL-driven Previous / page-number / Next pagination
 * - DataState empty state when no results
 *
 * ## Edge Cases
 * - SSR output should contain search query for SEO
 * - Language switching (zh-cn ↔ en-us) persists UI locale
 * - Filter params preserved in URL and restrict results
 * - Search supports nameCn, nameEn, and code fields
 */
import { expect, test } from "@playwright/test";
import {
  expectCatalogFilterSheet,
  openCatalogFilterSheet,
} from "../../../utils/catalog-filter-sheet";
import { DEV_SEED } from "../../../utils/dev-seed";
import {
  createTempCoursesFixture,
  deleteTempCoursesByPrefix,
  getSeedCourseFilterFixture,
} from "../../../utils/e2e-db";
import { visibleText } from "../../../utils/locators";
import {
  expectNoPageHorizontalOverflow,
  gotoAndWaitForReady,
} from "../../../utils/page-ready";
import { absoluteTestUrl } from "../../../utils/request-url";
import { captureStepScreenshot } from "../../../utils/screenshot";
import { assertPageContract } from "../_shared/page-contract";

test.describe("/catalog/courses 课程目录", () => {
  test.describe.configure({ mode: "serial" });

  test("页面契约", async ({ page }, testInfo) => {
    await assertPageContract(page, { routePath: "/catalog/courses", testInfo });
  });

  test("SSR 输出包含搜索查询", async ({ baseURL }) => {
    const response = await fetch(
      absoluteTestUrl(
        `/catalog/courses?search=${encodeURIComponent(DEV_SEED.course.code)}`,
        baseURL,
      ),
    );
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('id="main-content"');
    expect(html).toContain(DEV_SEED.course.code);
  });

  test("语言切换正常工作", async ({ page, baseURL }, testInfo) => {
    await gotoAndWaitForReady(page, "/catalog/courses", {
      testInfo,
      screenshotLabel: "courses",
    });

    const localeResponse = await fetch(
      absoluteTestUrl("/api/account/preferences", baseURL),
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ locale: "en-us" }),
      },
    );
    expect(localeResponse.status).toBe(200);

    await page.context().addCookies([
      {
        name: "NEXT_LOCALE",
        value: "en-us",
        url: absoluteTestUrl("/", baseURL),
        sameSite: "Lax",
      },
    ]);

    await gotoAndWaitForReady(page, "/catalog/courses", {
      testInfo,
      screenshotLabel: "courses",
    });
    await expect(page.locator("html")).toHaveAttribute("lang", "en-us");
    await expect(
      page.getByRole("navigation", { name: "Primary navigation" }),
    ).toHaveCount(1);
    await expect(
      page.getByRole("navigation", { name: "Footer navigation" }),
    ).toHaveCount(1);
    await captureStepScreenshot(page, testInfo, "courses-en-us");

    await page
      .getByRole("button", { name: /语言选择|Language selector/i })
      .click();
    await page
      .getByRole("menuitemradio", { name: /中文|Chinese/i })
      .first()
      .click();

    await expect(page.locator("html")).toHaveAttribute("lang", "zh-cn");
    await expect(page.getByRole("navigation", { name: "主导航" })).toHaveCount(
      1,
    );
    await expect(
      page.getByRole("navigation", { name: "页脚导航" }),
    ).toHaveCount(1);
    await captureStepScreenshot(page, testInfo, "courses-zh-cn");
  });

  test("移动端卡片可点击并导航到详情", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAndWaitForReady(
      page,
      `/catalog/courses?search=${encodeURIComponent(DEV_SEED.course.code)}`,
      { testInfo, screenshotLabel: "courses-list" },
    );
    await expectNoPageHorizontalOverflow(page);
    await expect(page.getByTestId("catalog-mobile-filters")).toBeVisible();
    await expect(page.getByTestId("catalog-filter-sidebar")).toHaveCount(0);
    await expect(page.getByTestId("catalog-results-summary")).toBeVisible();
    await expect(page.getByTestId("catalog-active-filters")).toBeVisible();
    const courseCode = page
      .locator('[data-slot="catalog-code"]')
      .filter({ hasText: DEV_SEED.course.code })
      .first();
    await expect(courseCode).toBeVisible();
    await expect(
      courseCode.locator("xpath=ancestor::*[@data-slot='badge']"),
    ).toHaveCount(0);
    await expectCatalogFilterSheet(page, [
      /培养层次|Education Level/i,
      /类别|Category/i,
      /课程类型|Class Type/i,
    ]);

    const detailLink = page
      .locator(
        `#main-content a[href="/catalog/courses/${DEV_SEED.course.jwId}"]:visible`,
      )
      .first();
    await expect(detailLink).toBeVisible();
    const box = await detailLink.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(250);
    expect(box?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(640);
    await captureStepScreenshot(page, testInfo, "courses-mobile-list");
    await detailLink.click();
    await expect(page).toHaveURL(
      new RegExp(`/catalog/courses/${DEV_SEED.course.jwId}`),
    );
    await captureStepScreenshot(page, testInfo, "courses-navigate-detail");
  });

  test("280 至 1440 像素通过筛选面板提供课程高级筛选", async ({
    page,
  }, testInfo) => {
    for (const width of [280, 320, 375, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await gotoAndWaitForReady(page, "/catalog/courses");
      await expectCatalogFilterSheet(page, [
        /培养层次|Education Level/i,
        /类别|Category/i,
        /课程类型|Class Type/i,
      ]);
      await expect(page.locator("vite-error-overlay")).toHaveCount(0);
      if (width === 280 || width === 375) {
        await captureStepScreenshot(
          page,
          testInfo,
          `courses-filter-sheet-${width}`,
        );
      }
    }
  });

  test("桌面表格截断溢出文本并为缺失次级名称保留等高占位", async ({
    page,
  }, testInfo) => {
    const prefix = `e2etable-${Date.now()}-${testInfo.workerIndex}`;
    const blankPrefix = `${prefix}-blank`;
    const namedPrefix = `${prefix}-named`;
    const blankName = `${"very-long-course-name-".repeat(12)}blank`;
    const namedName = `${"very-long-course-name-".repeat(12)}named`;
    const secondaryName = "Short alternate name";

    await createTempCoursesFixture({
      count: 1,
      nameCn: blankName,
      prefix: blankPrefix,
    });
    await createTempCoursesFixture({
      count: 1,
      nameCn: namedName,
      nameEn: secondaryName,
      prefix: namedPrefix,
    });

    try {
      await page.setViewportSize({ width: 1440, height: 900 });
      await gotoAndWaitForReady(
        page,
        `/catalog/courses?search=${encodeURIComponent(prefix)}`,
      );

      const rows = page.locator("table:visible tbody tr");
      const blankRow = rows.filter({ hasText: `${blankPrefix}-00` });
      const namedRow = rows.filter({ hasText: `${namedPrefix}-00` });
      await expect(blankRow).toHaveCount(1);
      await expect(namedRow).toHaveCount(1);

      const primaryText = blankRow
        .locator('[data-slot="truncated-text"]')
        .first();
      const primaryGeometry = await primaryText.evaluate((node) => ({
        clientWidth: node.clientWidth,
        scrollWidth: node.scrollWidth,
      }));
      expect(primaryGeometry.scrollWidth).toBeGreaterThan(
        primaryGeometry.clientWidth + 1,
      );

      await primaryText.hover();
      const tooltip = page.locator('[data-slot="tooltip-content"]:visible');
      await expect(tooltip).toContainText(`${blankName}-00`);

      await page.mouse.move(0, 0);
      await expect(tooltip).toHaveCount(0);
      const codeText = blankRow
        .locator("td")
        .nth(1)
        .locator('[data-slot="truncated-text"]');
      await expect(
        blankRow.locator('[data-slot="catalog-code"]'),
      ).toBeVisible();
      await expect(blankRow.locator('[data-slot="badge"]')).toHaveCount(0);
      const codeGeometry = await codeText.evaluate((node) => ({
        clientWidth: node.clientWidth,
        scrollWidth: node.scrollWidth,
      }));
      expect(codeGeometry.scrollWidth).toBeGreaterThan(
        codeGeometry.clientWidth + 1,
      );
      await codeText.hover();
      await expect(tooltip).toContainText(`${blankPrefix}-00`);

      await page.mouse.move(0, 0);
      await expect(tooltip).toHaveCount(0);
      const shortSecondaryText = namedRow
        .locator('[data-slot="truncated-text"]')
        .filter({ hasText: secondaryName });
      await expect(shortSecondaryText).not.toHaveAttribute("tabindex");
      await shortSecondaryText.hover();
      await expect(tooltip).toHaveCount(0);

      const blankRowLink = blankRow.locator("a").first();
      await blankRowLink.focus();
      await expect(tooltip).toContainText(`${blankName}-00`);
      await expect(blankRowLink).toHaveAccessibleName(`${blankName}-00`);
      await page.keyboard.press("Tab");

      const placeholder = blankRow.locator(
        '[data-slot="truncated-text-placeholder"][aria-hidden="true"]',
      );
      await expect(placeholder).toHaveCount(1);
      expect((await placeholder.boundingBox())?.height ?? 0).toBeGreaterThan(0);

      const [blankBox, namedBox] = await Promise.all([
        blankRow.boundingBox(),
        namedRow.boundingBox(),
      ]);
      expect(
        Math.abs((blankBox?.height ?? 0) - (namedBox?.height ?? 0)),
      ).toBeLessThan(1);
      await codeText.hover();
      await expect(tooltip).toContainText(`${blankPrefix}-00`);
      await captureStepScreenshot(page, testInfo, "courses-table-truncation");
    } finally {
      await deleteTempCoursesByPrefix(prefix);
    }
  });

  test("分页提供上一页、页码和下一页并写入浏览历史", async ({
    page,
  }, testInfo) => {
    const prefix = `e2epagination-${Date.now()}-${testInfo.workerIndex}`;
    await createTempCoursesFixture({ count: 25, prefix });

    try {
      const searchPath = `/catalog/courses?search=${prefix}`;
      await gotoAndWaitForReady(page, searchPath, {
        testInfo,
        screenshotLabel: "courses-page-1",
      });

      let pagination = page.getByTestId("catalog-pagination");
      await expect(pagination).toBeVisible();
      await expect(pagination.locator('[aria-current="page"]')).toHaveText("1");
      await expect(
        pagination.getByRole("link", { name: /分页 2|Pagination 2/i }),
      ).toHaveAttribute("href", `${searchPath}&page=2`);

      const nextLink = pagination.getByRole("link", {
        name: /下一页|Next page/i,
      });
      await expect(nextLink).toHaveAttribute("href", `${searchPath}&page=2`);
      await nextLink.click();
      await expect(page).toHaveURL(
        new RegExp(`/catalog/courses\\?search=${prefix}&page=2$`),
      );

      pagination = page.getByTestId("catalog-pagination");
      await expect(pagination.locator('[aria-current="page"]')).toHaveText("2");
      await expect(
        pagination.getByRole("link", { name: /上一页|Previous page/i }),
      ).toHaveAttribute("href", searchPath);
      await captureStepScreenshot(page, testInfo, "courses-pagination");

      await page.goBack();
      await expect(page).toHaveURL(
        new RegExp(`/catalog/courses\\?search=${prefix}$`),
      );
    } finally {
      await deleteTempCoursesByPrefix(prefix);
    }
  });

  test("搜索和清除按钮", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAndWaitForReady(page, "/catalog/courses", {
      testInfo,
      screenshotLabel: "courses",
    });

    const searchbox = page.getByRole("searchbox").first();
    await expect(searchbox).toBeVisible();

    await searchbox.fill(DEV_SEED.course.code);
    const searchButton = page
      .getByRole("button", { name: /搜索|Search/i })
      .first();
    await expect(searchButton).toBeVisible();
    await searchButton.click();

    await expect(page).toHaveURL(/search=/);
    await captureStepScreenshot(page, testInfo, "courses-search-filled");

    const clearLink = page.getByRole("link", { name: /清除|Clear/i }).first();
    await expect(clearLink).toBeVisible();
    await clearLink.click();
    await expect(page).not.toHaveURL(/search=/);

    await captureStepScreenshot(page, testInfo, "courses-search-clear");
  });

  test("按种子维度筛选保留结果", async ({ page }, testInfo) => {
    const filters = await getSeedCourseFilterFixture(DEV_SEED.course.jwId);
    expect(filters.educationLevelId).toBeTruthy();
    expect(filters.categoryId).toBeTruthy();
    await gotoAndWaitForReady(page, "/catalog/courses", {
      testInfo,
      screenshotLabel: "courses-filter",
    });

    await page.getByRole("searchbox").fill("尚未提交的搜索草稿");
    let filterDialog = await openCatalogFilterSheet(page);
    await filterDialog
      .getByLabel(/培养层次|Education Level/i)
      .selectOption(String(filters.educationLevelId));
    await expect(page).toHaveURL(
      new RegExp(`educationLevelId=${filters.educationLevelId}`),
    );
    await expect(page).not.toHaveURL(/search=/);

    filterDialog = await openCatalogFilterSheet(page);
    await filterDialog
      .getByLabel(/类别|Category/i)
      .selectOption(String(filters.categoryId));
    await expect(page).toHaveURL(
      new RegExp(
        `educationLevelId=${filters.educationLevelId}.*categoryId=${filters.categoryId}`,
      ),
    );

    await expect(page.getByTestId("catalog-filter-sidebar")).toHaveCount(0);
    await expect(page.getByTestId("catalog-mobile-filters")).toBeVisible();
    await expect(visibleText(page, DEV_SEED.course.code)).toBeVisible();
    await captureStepScreenshot(page, testInfo, "courses-filter-seed");
  });
});
