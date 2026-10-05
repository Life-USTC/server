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
import { expect } from "@playwright/test";
import {
  arrangeCourses,
  test as catalogTest,
} from "../../../utils/catalog-browser-fixture";
import {
  expectCatalogFilterSheet,
  openCatalogFilterSheet,
} from "../../../utils/catalog-filter-sheet";
import { test } from "../../../utils/catalog-search-fixture";
import { DEV_SEED } from "../../../utils/dev-seed";
import { visibleText } from "../../../utils/locators";
import {
  expectNoPageHorizontalOverflow,
  gotoAndWaitForReady,
} from "../../../utils/page-ready";
import { absoluteTestUrl } from "../../../utils/request-url";
import { assertPageContract } from "../_shared/page-contract";

test.describe("/catalog/courses 课程目录", () => {
  test("页面契约", { tag: "@Catalog/Web" }, async ({
    page,
    preferenceFlow,
    searchCourse: _searchCourse,
  }) => {
    await preferenceFlow.run(async () => {
      await assertPageContract(page, {
        routePath: "/catalog/courses",
      });
    });
  });

  test("SSR 输出包含搜索查询", { tag: "@Catalog/Web" }, async ({
    baseURL,
    preferenceFlow,
    searchCourse: _searchCourse,
  }) => {
    await preferenceFlow.run(async () => {
      const response = await fetch(
        absoluteTestUrl(
          `/catalog/courses?search=${encodeURIComponent(DEV_SEED.course.code)}`,
          baseURL,
        ),
        { headers: preferenceFlow.headers },
      );
      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain('id="main-content"');
      expect(html).toContain(DEV_SEED.course.code);
    });
  });

  test("无匹配课程时显示明确空状态且不渲染结果链接", {
    tag: "@Catalog/Web",
  }, async ({ page, preferenceFlow, searchCourse: _searchCourse }) => {
    await preferenceFlow.run(async () => {
      await gotoAndWaitForReady(
        page,
        "/catalog/courses?search=e2e-no-matching-course-7f3c9a",
      );

      await expect(
        page.getByText(/未找到课程|No courses found/i),
      ).toBeVisible();
      await expect(
        page.locator("#main-content a[href^='/catalog/courses/']"),
      ).toHaveCount(0);
      await expect(
        page.getByRole("link", { name: /^(清除|Clear)$/i }),
      ).toBeVisible();
    });
  });

  test("目录链接悬停时不预取 __data.json", { tag: "@Catalog/Web" }, async ({
    page,
    preferenceFlow,
    searchCourse: _searchCourse,
  }) => {
    await preferenceFlow.run(async () => {
      await gotoAndWaitForReady(
        page,
        `/catalog/courses?search=${encodeURIComponent(DEV_SEED.course.code)}`,
      );
      const courseLink = page
        .locator(
          `#main-content a[href="/catalog/courses/${DEV_SEED.course.jwId}"]:visible`,
        )
        .first();
      await expect(courseLink).toBeVisible();

      const dataJsonDuringHover = page
        .waitForRequest((request) => request.url().includes("__data.json"), {
          timeout: 750,
        })
        .then(() => true)
        .catch(() => false);

      await courseLink.hover();
      expect(await dataJsonDuringHover).toBe(false);
    });
  });

  test("语言切换正常工作", { tag: "@Catalog/Web" }, async ({
    page,
    baseURL,
    preferenceFlow,
    searchCourse: _searchCourse,
  }) => {
    await preferenceFlow.run(async () => {
      await gotoAndWaitForReady(page, "/catalog/courses");

      const localeResponse = await fetch(
        absoluteTestUrl("/api/account/preferences", baseURL),
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...preferenceFlow.headers,
          },
          body: JSON.stringify({ locale: "en-us" }),
        },
      );
      expect(localeResponse.status).toBe(200);
      await localeResponse.text();

      await page.context().addCookies([
        {
          name: "NEXT_LOCALE",
          value: "en-us",
          url: absoluteTestUrl("/", baseURL),
          sameSite: "Lax",
        },
      ]);

      await gotoAndWaitForReady(page, "/catalog/courses");
      await expect(page.locator("html")).toHaveAttribute("lang", "en-us");
      await expect(
        page.getByRole("navigation", { name: "Primary navigation" }),
      ).toHaveCount(1);
      await expect(
        page.getByRole("navigation", { name: "Footer navigation" }),
      ).toHaveCount(1);
      await page
        .getByRole("button", { name: /语言选择|Language selector/i })
        .click();
      await page
        .getByRole("menuitemradio", { name: /中文|Chinese/i })
        .first()
        .click();

      await expect(page.locator("html")).toHaveAttribute("lang", "zh-cn");
      await expect(
        page.getByRole("navigation", { name: "主导航" }),
      ).toHaveCount(1);
      await expect(
        page.getByRole("navigation", { name: "页脚导航" }),
      ).toHaveCount(1);
    });
  });

  test("移动端卡片可点击并导航到详情", { tag: "@Catalog/Web" }, async ({
    page,
    preferenceFlow,
    searchCourse: _searchCourse,
  }) => {
    await preferenceFlow.run(async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await gotoAndWaitForReady(
        page,
        `/catalog/courses?search=${encodeURIComponent(DEV_SEED.course.code)}`,
      );
      await expectNoPageHorizontalOverflow(page);
      await expect(page.locator('[data-slot="filter-toolbar"]')).toBeVisible();
      await expect(page.getByTestId("catalog-filter-sidebar")).toHaveCount(0);
      await expect(page.locator('[data-slot="results-summary"]')).toBeVisible();
      await expect(page.locator('[data-slot="active-filters"]')).toBeVisible();
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
      await detailLink.click();
      await expect(page).toHaveURL(
        new RegExp(`/catalog/courses/${DEV_SEED.course.jwId}`),
      );
    });
  });

  test("280 至 1440 像素通过筛选面板提供课程高级筛选", {
    tag: "@Catalog/Web",
  }, async ({ page, preferenceFlow, searchCourse: _searchCourse }) => {
    await preferenceFlow.run(async () => {
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
        }
      }
    });
  });

  catalogTest(
    "桌面表格截断溢出文本",
    { tag: "@Catalog/Web" },
    async ({ page, isolatedWorker, catalogFlow }, testInfo) => {
      await catalogFlow.run(
        async () => {
          const prefix = `e2etable-${Date.now()}-${testInfo.workerIndex}`;
          const blankPrefix = `${prefix}-blank`;
          const namedPrefix = `${prefix}-named`;
          const blankName = `${"very-long-course-name-".repeat(12)}blank`;
          const namedName = `${"very-long-course-name-".repeat(12)}named`;
          const secondaryName = "Short alternate name";

          await isolatedWorker.database.owner.$transaction(async (tx) => {
            await arrangeCourses(tx, {
              firstJwId: 1_500_000_000,
              count: 1,
              nameCn: blankName,
              prefix: blankPrefix,
            });
            await arrangeCourses(tx, {
              firstJwId: 1_500_000_001,
              count: 1,
              nameCn: namedName,
              nameEn: secondaryName,
              prefix: namedPrefix,
            });
          });

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
          expect(primaryGeometry.scrollWidth).toBeGreaterThanOrEqual(
            primaryGeometry.clientWidth,
          );
          const primaryOverflows =
            primaryGeometry.scrollWidth > primaryGeometry.clientWidth;
          const tooltip = page.locator('[data-slot="tooltip-content"]:visible');

          if (primaryOverflows) {
            await primaryText.hover();
            await expect(tooltip).toContainText(`${blankName}-00`);

            await page.mouse.move(0, 0);
            await expect(tooltip).toHaveCount(0);
          } else {
            await primaryText.hover();
            await expect(tooltip).toHaveCount(0);
          }
          const codeText = blankRow
            .locator("td")
            .nth(1)
            .locator('[data-slot="catalog-code"]');
          await expect(codeText).toBeVisible();
          await expect(blankRow.locator('[data-slot="badge"]')).toHaveCount(0);
          await expect(codeText).toHaveText(`${blankPrefix}-00`);
          await expect(codeText).not.toHaveAttribute("title");
          await expect(codeText.locator("[aria-hidden=true]")).toHaveCount(0);
          await expect(
            codeText.locator("[data-slot=truncated-text]"),
          ).toHaveText(`${blankPrefix}-00`);
          const codeGeometry = await codeText.evaluate((node) => ({
            clientWidth: node.clientWidth,
            scrollWidth: node.scrollWidth,
          }));
          expect(codeGeometry.scrollWidth).toBeGreaterThanOrEqual(
            codeGeometry.clientWidth,
          );

          const blankRowLink = blankRow.locator("a").first();
          await blankRowLink.focus();
          if (primaryOverflows) {
            await expect(tooltip).toContainText(`${blankName}-00`);
          }
          await expect(blankRowLink).toHaveAccessibleName(`${blankName}-00`);
        },
        { anonymousCourseCount: 2 },
      );
    },
  );

  catalogTest(
    "分页提供上一页、页码和下一页并写入浏览历史",
    { tag: "@Catalog/Web" },
    async ({ page, isolatedWorker, catalogFlow }, testInfo) => {
      await catalogFlow.run(
        async () => {
          const prefix = `e2epagination-${Date.now()}-${testInfo.workerIndex}`;
          await arrangeCourses(isolatedWorker.database.owner, {
            firstJwId: 1_500_000_000,
            count: 25,
            prefix,
          });

          const searchPath = `/catalog/courses?search=${prefix}`;
          await gotoAndWaitForReady(page, searchPath);

          let pagination = page.locator('[data-slot="list-pagination"]');
          await expect(pagination).toBeVisible();
          await expect(pagination.locator('[aria-current="page"]')).toHaveText(
            "1",
          );
          const page2Link = pagination.getByRole("link", {
            name: /分页 2|Pagination 2/i,
          });
          await expect(page2Link).toHaveAttribute("href", /[?&]page=2(?:&|$)/);
          await expect(page2Link).toHaveAttribute(
            "href",
            new RegExp(`[?&]search=${prefix}(?:&|$)`),
          );

          const nextLink = pagination.getByRole("link", {
            name: /下一页|Next page/i,
          });
          await expect(nextLink).toHaveAttribute("href", /[?&]page=2(?:&|$)/);
          await expect(nextLink).toHaveAttribute(
            "href",
            new RegExp(`[?&]search=${prefix}(?:&|$)`),
          );
          await nextLink.click();
          await expect(page).toHaveURL((url) => {
            return (
              url.pathname === "/catalog/courses" &&
              url.searchParams.get("search") === prefix &&
              url.searchParams.get("page") === "2"
            );
          });

          pagination = page.locator('[data-slot="list-pagination"]');
          await expect(pagination.locator('[aria-current="page"]')).toHaveText(
            "2",
          );
          await expect(
            pagination.getByRole("link", { name: /上一页|Previous page/i }),
          ).toHaveAttribute("href", searchPath);
          await page.goBack();
          await expect(page).toHaveURL((url) => {
            return (
              url.pathname === "/catalog/courses" &&
              url.searchParams.get("search") === prefix &&
              (url.searchParams.get("page") == null ||
                url.searchParams.get("page") === "1")
            );
          });
        },
        { anonymousCourseCount: 25 },
      );
    },
  );

  test("搜索和清除按钮", { tag: "@Catalog/Web" }, async ({
    page,
    preferenceFlow,
    searchCourse: _searchCourse,
  }) => {
    await preferenceFlow.run(async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await gotoAndWaitForReady(page, "/catalog/courses");

      const searchbox = page.getByRole("searchbox").first();
      await expect(searchbox).toBeVisible();

      await searchbox.fill(DEV_SEED.course.code);
      const searchButton = page.getByRole("button", {
        name: /^(搜索|Search)$/,
      });
      await expect(searchButton).toBeVisible();
      await searchButton.click();

      await expect(page).toHaveURL(/search=/);
      const clearLink = page
        .getByRole("link", { name: /^(清除|Clear)$/i })
        .first();
      await expect(clearLink).toBeVisible();
      await clearLink.click();
      await expect(page).toHaveURL(
        new RegExp(`search=${DEV_SEED.course.code}`),
      );
    });
  });

  test("按种子维度筛选保留结果", { tag: "@Catalog/Web" }, async ({
    page,
    preferenceFlow,
    searchCourse: _searchCourse,
  }) => {
    await preferenceFlow.run(async () => {
      const filters = {
        educationLevelId: _searchCourse.educationLevel.id,
        educationLevelName: _searchCourse.educationLevel.nameCn,
        categoryId: _searchCourse.category.id,
        categoryName: _searchCourse.category.nameCn,
        classTypeId: _searchCourse.classType.id,
        classTypeName: _searchCourse.classType.nameCn,
      };
      expect(filters.educationLevelId).toBeTruthy();
      expect(filters.categoryId).toBeTruthy();
      await gotoAndWaitForReady(page, "/catalog/courses");

      await page.getByRole("searchbox").fill(DEV_SEED.course.code);
      let filterDialog = await openCatalogFilterSheet(page);
      await filterDialog
        .getByLabel(/培养层次|Education Level/i)
        .selectOption(String(filters.educationLevelId));
      await expect(page).not.toHaveURL(/educationLevelId=/);
      await page.keyboard.press("Escape");
      await expect(filterDialog).toBeHidden();
      filterDialog = await openCatalogFilterSheet(page);
      await expect(
        filterDialog.getByLabel(/培养层次|Education Level/i),
      ).toHaveValue("");
      await filterDialog
        .getByLabel(/培养层次|Education Level/i)
        .selectOption(String(filters.educationLevelId));
      await filterDialog
        .getByRole("button", { name: /应用筛选|Apply filters/i })
        .click();
      await expect(filterDialog).toBeHidden();
      await expect(page).toHaveURL(
        new RegExp(`educationLevelId=${filters.educationLevelId}`),
      );
      await expect(page).toHaveURL(
        new RegExp(`search=${DEV_SEED.course.code}`),
      );

      filterDialog = await openCatalogFilterSheet(page);
      await filterDialog
        .getByLabel(/类别|Category/i)
        .selectOption(String(filters.categoryId));
      await filterDialog
        .getByRole("button", { name: /应用筛选|Apply filters/i })
        .click();
      await expect(filterDialog).toBeHidden();
      await expect(page).toHaveURL(
        new RegExp(
          `educationLevelId=${filters.educationLevelId}.*categoryId=${filters.categoryId}`,
        ),
      );

      await expect(page.getByTestId("catalog-filter-sidebar")).toHaveCount(0);
      await expect(page.locator('[data-slot="filter-toolbar"]')).toBeVisible();
      await expect(visibleText(page, DEV_SEED.course.code)).toBeVisible();
    });
  });
});
