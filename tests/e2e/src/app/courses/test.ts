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
 * - Pagination controls (Previous, page numbers, Next) when totalPages > 1
 * - DataState empty state when no results
 * - Breadcrumbs: Home > Courses
 *
 * ## Edge Cases
 * - SSR output should contain search query for SEO
 * - Language switching (zh-cn ↔ en-us) persists UI locale
 * - Filter params preserved in URL and restrict results
 * - Search supports nameCn, nameEn, and code fields
 */
import { expect, test } from "@playwright/test";
import { DEV_SEED } from "../../../utils/dev-seed";
import { getSeedCourseFilterFixture } from "../../../utils/e2e-db";
import { visibleText } from "../../../utils/locators";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { absoluteTestUrl } from "../../../utils/request-url";
import { captureStepScreenshot } from "../../../utils/screenshot";
import { assertPageContract } from "../_shared/page-contract";

test.describe("/courses 课程目录", () => {
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
    const detailLink = page
      .locator(
        `#main-content a[href="/courses/${DEV_SEED.course.jwId}"]:visible`,
      )
      .first();
    await expect(detailLink).toBeVisible();
    const box = await detailLink.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(250);
    await captureStepScreenshot(page, testInfo, "courses-mobile-list");
    await detailLink.click();
    await expect(page).toHaveURL(
      new RegExp(`/courses/${DEV_SEED.course.jwId}`),
    );
    await captureStepScreenshot(page, testInfo, "courses-navigate-detail");
  });

  test("搜索和清除按钮", async ({ page }, testInfo) => {
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

    await expect(visibleText(page, DEV_SEED.course.code)).toBeVisible();
    await captureStepScreenshot(page, testInfo, "courses-filter-seed");
  });
});
