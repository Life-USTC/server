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

test.describe("/courses 课程目录", () => {
  test.describe.configure({ mode: "serial" });

  test("页面契约", async ({ page }, testInfo) => {
    await assertPageContract(page, { routePath: "/courses", testInfo });
  });

  test("SSR 输出包含搜索查询", async ({ baseURL }) => {
    const response = await fetch(
      absoluteTestUrl(
        `/courses?search=${encodeURIComponent(DEV_SEED.course.code)}`,
        baseURL,
      ),
    );
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('id="main-content"');
    expect(html).toContain(DEV_SEED.course.code);
  });

  test("语言切换正常工作", async ({ page, baseURL }, testInfo) => {
    await gotoAndWaitForReady(page, "/courses", {
      testInfo,
      screenshotLabel: "courses",
    });

    const localeResponse = await fetch(
      absoluteTestUrl("/api/locale", baseURL),
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

    await gotoAndWaitForReady(page, "/courses", {
      testInfo,
      screenshotLabel: "courses",
    });
    await expect(page.locator("html")).toHaveAttribute("lang", "en-us");
    await captureStepScreenshot(page, testInfo, "courses-en-us");

    await page
      .getByRole("button", { name: /语言选择|Language selector/i })
      .click();
    await page
      .getByRole("menuitemradio", { name: /中文|Chinese/i })
      .first()
      .click();

    await expect(page.locator("html")).toHaveAttribute("lang", "zh-cn");
    await captureStepScreenshot(page, testInfo, "courses-zh-cn");
  });

  test("移动端卡片可点击并导航到详情", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAndWaitForReady(
      page,
      `/courses?search=${encodeURIComponent(DEV_SEED.course.code)}`,
      { testInfo, screenshotLabel: "courses-list" },
    );
    await expectNoPageHorizontalOverflow(page);
    await expect(page.getByTestId("catalog-mobile-filters")).toBeVisible();
    await expect(page.getByTestId("catalog-filter-sidebar")).toBeHidden();
    await expect(page.getByTestId("catalog-results-summary")).toBeVisible();
    await expect(page.getByTestId("catalog-active-filters")).toBeVisible();
    await page.getByRole("button", { name: /筛选|Filters/i }).click();
    const filterSheet = page.getByRole("dialog");
    await expect(filterSheet).toBeVisible();
    await expect(
      filterSheet.getByLabel(/培养层次|Education Level/i),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    const detailLink = page
      .locator(
        `#main-content a[href="/courses/${DEV_SEED.course.jwId}"]:visible`,
      )
      .first();
    await expect(detailLink).toBeVisible();
    const box = await detailLink.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(250);
    expect(box?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(640);
    await captureStepScreenshot(page, testInfo, "courses-mobile-list");
    await detailLink.click();
    await expect(page).toHaveURL(
      new RegExp(`/courses/${DEV_SEED.course.jwId}`),
    );
    await captureStepScreenshot(page, testInfo, "courses-navigate-detail");
  });

  test("分页提供上一页、页码和下一页并写入浏览历史", async ({
    page,
  }, testInfo) => {
    const prefix = `e2epagination-${Date.now()}-${testInfo.workerIndex}`;
    await createTempCoursesFixture({ count: 25, prefix });

    try {
      const searchPath = `/courses?search=${prefix}`;
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
        new RegExp(`/courses\\?search=${prefix}&page=2$`),
      );

      pagination = page.getByTestId("catalog-pagination");
      await expect(pagination.locator('[aria-current="page"]')).toHaveText("2");
      await expect(
        pagination.getByRole("link", { name: /上一页|Previous page/i }),
      ).toHaveAttribute("href", searchPath);
      await captureStepScreenshot(page, testInfo, "courses-pagination");

      await page.goBack();
      await expect(page).toHaveURL(new RegExp(`/courses\\?search=${prefix}$`));
    } finally {
      await deleteTempCoursesByPrefix(prefix);
    }
  });

  test("搜索和清除按钮", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAndWaitForReady(page, "/courses", {
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
    const params = new URLSearchParams();
    if (filters.educationLevelId) {
      params.set("educationLevelId", String(filters.educationLevelId));
    }
    if (filters.categoryId) {
      params.set("categoryId", String(filters.categoryId));
    }
    if (filters.classTypeId) {
      params.set("classTypeId", String(filters.classTypeId));
    }

    await gotoAndWaitForReady(page, `/courses?${params.toString()}`, {
      testInfo,
      screenshotLabel: "courses-filter",
    });

    await expect(page.getByTestId("catalog-filter-sidebar")).toBeVisible();
    await expect(page.getByTestId("catalog-mobile-filters")).toBeHidden();
    await expect(visibleText(page, DEV_SEED.course.code)).toBeVisible();
    await captureStepScreenshot(page, testInfo, "courses-filter-seed");
  });
});
