/**
 * E2E tests for /sections — Advanced Section Search
 *
 * ## Data Represented
 * - Sections with course, semester, teachers, credits, campus, capacity
 * - Seed section: DEV_SEED.section (jwId 9902001) for DEV_SEED.course
 *
 * ## UI/UX Elements
 * - Plain search input for course names and course/section codes
 * - Structured filters for section, course metadata, and sorting
 * - Collapsible advanced syntax reference inside the filter sheet
 * - Table: Semester, Course Name, Section Code, Teachers, Credits, Capacity, Campus
 * - Clickable rows navigating to /sections/{jwId}
 * - URL-driven Previous / page-number / Next pagination
 * - DataState empty state when no results
 * - Clear filter link
 *
 * ## Edge Cases
 * - SSR output contains search query for SEO
 * - 280–375 px layouts remain usable without horizontal overflow
 * - Structured filters update URL parameters and preserve matching results
 * - Advanced search syntax parsed server-side (sort:, order:asc/desc)
 */
import { expect, type Page, test } from "@playwright/test";
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

async function useChineseLocale(page: Page) {
  const response = await page.request.post("/api/locale", {
    data: { locale: "zh-cn" },
  });
  expect(response.status()).toBe(200);
}

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
    const runtimeErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") runtimeErrors.push(message.text());
    });
    page.on("pageerror", (error) => runtimeErrors.push(error.message));

    await page.setViewportSize({ width: 375, height: 844 });
    await useChineseLocale(page);
    await gotoAndWaitForReady(
      page,
      `/sections?search=${encodeURIComponent(DEV_SEED.section.code)}`,
      { testInfo, screenshotLabel: "sections-list" },
    );
    await expectNoPageHorizontalOverflow(page);
    await expect(page.getByTestId("catalog-mobile-filters")).toBeVisible();
    await expect(page.getByTestId("catalog-filter-sidebar")).toHaveCount(0);
    await expect(page.getByTestId("catalog-results-summary")).toBeVisible();
    await expect(page.getByTestId("catalog-active-filters")).toBeVisible();
    await expect(page.getByRole("heading", { name: "所有班级" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-cn");
    await expect(page).toHaveTitle(/班级/);

    const mobileFilters = page.getByTestId("catalog-mobile-filters");
    const mobileFilterLayout = await mobileFilters.evaluate((node) => {
      const container = node as HTMLElement;
      const searchbox = container.querySelector('[type="search"]');
      const actionButtons = Array.from(
        container.querySelectorAll<HTMLButtonElement>("button"),
      );
      const activeFilters = container.querySelector(
        '[data-testid="catalog-active-filters"]',
      );
      const inputGroup = searchbox?.closest<HTMLElement>(
        '[data-slot="input-group"]',
      );
      if (
        !searchbox ||
        !inputGroup ||
        actionButtons.length < 2 ||
        !activeFilters
      ) {
        throw new Error("Mobile catalog filter geometry missing");
      }

      const containerBox = container.getBoundingClientRect();
      const searchboxBox = inputGroup.getBoundingClientRect();
      const actionBottom = Math.max(
        ...actionButtons.map((button) => button.getBoundingClientRect().bottom),
      );
      const activeFiltersBox = activeFilters.getBoundingClientRect();
      const style = getComputedStyle(container);
      return {
        activeFiltersGap: activeFiltersBox.top - actionBottom,
        borderTopWidth: style.borderTopWidth,
        height: containerBox.height,
        paddingTop: style.paddingTop,
        searchTop: searchboxBox.top - containerBox.top,
      };
    });
    expect(mobileFilterLayout.borderTopWidth).toBe("0px");
    expect(mobileFilterLayout.paddingTop).toBe("0px");
    expect(mobileFilterLayout.searchTop).toBeGreaterThanOrEqual(0);
    expect(mobileFilterLayout.searchTop).toBeLessThanOrEqual(1);
    expect(mobileFilterLayout.activeFiltersGap).toBeGreaterThanOrEqual(8);
    expect(mobileFilterLayout.activeFiltersGap).toBeLessThan(24);
    expect(mobileFilterLayout.height).toBeLessThan(180);

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
    await expect(page.locator("vite-error-overlay")).toHaveCount(0);
    expect(runtimeErrors).toEqual([]);
    await captureStepScreenshot(page, testInfo, "sections-navigate-detail");
  });

  test("英文界面本地化班级列表名称", async ({ page }, testInfo) => {
    const runtimeErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") runtimeErrors.push(message.text());
    });
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    await page.setViewportSize({ width: 390, height: 844 });
    const localeResponse = await page.request.post("/api/locale", {
      data: { locale: "en-us" },
    });
    expect(localeResponse.status()).toBe(200);

    await gotoAndWaitForReady(
      page,
      `/sections?search=${encodeURIComponent(DEV_SEED.section.code)}`,
    );

    await expect(visibleText(page, DEV_SEED.course.nameEn)).toBeVisible();
    await expect(visibleText(page, DEV_SEED.course.nameCn)).toBeVisible();
    await expect(visibleText(page, DEV_SEED.teacher.nameEn)).toBeVisible();
    await expect(visibleText(page, DEV_SEED.campus.nameEn)).toBeVisible();
    await expect(page.locator("vite-error-overlay")).toHaveCount(0);
    expect(runtimeErrors).toEqual([]);
    await captureStepScreenshot(page, testInfo, "sections-mobile-list-en-us");
  });

  test("280 至 375 像素窄屏筛选与帮助不溢出", async ({ page }, testInfo) => {
    await useChineseLocale(page);

    for (const width of [280, 320, 360, 375]) {
      await page.setViewportSize({ width, height: 900 });
      await gotoAndWaitForReady(
        page,
        `/sections?search=${encodeURIComponent(DEV_SEED.section.code)}`,
      );
      await expectNoPageHorizontalOverflow(page);

      const mobileFilters = page.getByTestId("catalog-mobile-filters");
      const searchbox = page.getByRole("searchbox");
      const searchButton = page.getByRole("button", { name: /^搜索$/ });
      const filterButton = page.getByRole("button", { name: /筛选/ });
      await expect(mobileFilters).toBeVisible();

      const toolbarGeometry = await mobileFilters.evaluate((node) => {
        const form = node.querySelector("form");
        const input = node.querySelector<HTMLInputElement>('[type="search"]');
        const buttons = Array.from(
          node.querySelectorAll<HTMLButtonElement>("form > button"),
        );
        if (!form || !input || buttons.length === 0) {
          throw new Error("Mobile toolbar geometry missing");
        }
        const inputGroup = input.closest<HTMLElement>(
          '[data-slot="input-group"]',
        );
        const containerBox = (node as HTMLElement).getBoundingClientRect();
        const inputBox = (inputGroup ?? input).getBoundingClientRect();
        return {
          containerLeft: containerBox.left,
          containerRight: containerBox.right,
          inputBottom: inputBox.bottom,
          inputLeft: inputBox.left,
          inputRight: inputBox.right,
        };
      });
      const searchButtonBox = await searchButton.boundingBox();
      const filterButtonBox = await filterButton.boundingBox();
      expect(toolbarGeometry.containerLeft).toBeGreaterThanOrEqual(0);
      expect(toolbarGeometry.containerRight).toBeLessThanOrEqual(width);
      expect(toolbarGeometry.inputLeft).toBeGreaterThanOrEqual(
        toolbarGeometry.containerLeft,
      );
      expect(toolbarGeometry.inputRight).toBeLessThanOrEqual(
        toolbarGeometry.containerRight,
      );
      expect(searchButtonBox).not.toBeNull();
      expect(filterButtonBox).not.toBeNull();

      expect(searchButtonBox?.y ?? 0).toBeGreaterThanOrEqual(
        toolbarGeometry.inputBottom,
      );
      expect(searchButtonBox?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(filterButtonBox?.height ?? 0).toBeGreaterThanOrEqual(44);

      await filterButton.click();
      const filterSheet = page.getByRole("dialog");
      await expect(filterSheet).toBeVisible();
      for (const label of [
        "学期",
        "教师",
        "课程代码",
        "班级代码",
        "校区",
        "院系",
        "学分",
        "课程类别",
        "教育层次",
        "课程类型",
        "排序字段",
        "排序方向",
      ]) {
        await expect(
          filterSheet.getByLabel(label, { exact: true }),
        ).toHaveCount(1);
      }

      await filterSheet.getByRole("button", { name: "高级搜索语法" }).click();
      await expect(filterSheet.getByText('semester:"2024 春"')).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(1);

      const sheetGeometry = await filterSheet.evaluate((node) => {
        const root = node as HTMLElement;
        const box = root.getBoundingClientRect();
        const overflowing = Array.from(
          root.querySelectorAll<HTMLElement>("*"),
        ).flatMap((element) => {
          const elementBox = element.getBoundingClientRect();
          const overflowWidth = element.scrollWidth - element.clientWidth;
          return element.clientWidth > 0 &&
            !element.classList.contains("sr-only") &&
            overflowWidth > 1 &&
            elementBox.right + overflowWidth > box.right + 1
            ? [
                {
                  clientWidth: element.clientWidth,
                  scrollWidth: element.scrollWidth,
                  text: element.textContent
                    ?.trim()
                    .replace(/\s+/g, " ")
                    .slice(0, 80),
                },
              ]
            : [];
        });
        return {
          left: box.left,
          overflowing,
          right: box.right,
        };
      });
      expect(sheetGeometry.left).toBeGreaterThanOrEqual(0);
      expect(sheetGeometry.right).toBeLessThanOrEqual(width);
      expect(sheetGeometry.overflowing).toEqual([]);

      if (width === 280 || width === 375) {
        await captureStepScreenshot(
          page,
          testInfo,
          `sections-filters-${width}`,
        );
      }
      await page.keyboard.press("Escape");
      await expect(filterSheet).toBeHidden();
      await expect(searchbox).toBeVisible();
    }
  });

  test("中文目录在桌面宽度下不裁切或横向溢出", async ({ page }, testInfo) => {
    const runtimeErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") runtimeErrors.push(message.text());
    });
    page.on("pageerror", (error) => runtimeErrors.push(error.message));

    await useChineseLocale(page);
    for (const width of [1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await gotoAndWaitForReady(page, "/sections");

      await expect(page.locator("html")).toHaveAttribute("lang", "zh-cn");
      await expect(page).toHaveTitle(/班级/);
      await expect(page.locator("vite-error-overlay")).toHaveCount(0);
      await expect(page.getByTestId("catalog-mobile-filters")).toBeVisible();
      await expect(page.getByTestId("catalog-filter-sidebar")).toHaveCount(0);

      const documentGeometry = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(documentGeometry.scrollWidth).toBeLessThanOrEqual(
        documentGeometry.clientWidth,
      );

      if (width === 1024) {
        const cards = page.getByTestId("catalog-results-cards");
        await expect(cards).toBeVisible();
        await expect(
          page.locator('[data-slot="table-container"]:visible'),
        ).toHaveCount(0);
        const cardsGeometry = await cards.evaluate((node) => {
          const cardsBox = (node as HTMLElement).getBoundingClientRect();
          const mainBox = document
            .querySelector<HTMLElement>("#main-content")
            ?.getBoundingClientRect();
          if (!mainBox) throw new Error("Main content geometry missing");
          return {
            left: cardsBox.left,
            mainLeft: mainBox.left,
            mainRight: mainBox.right,
            right: cardsBox.right,
          };
        });
        expect(cardsGeometry.left).toBeGreaterThanOrEqual(
          cardsGeometry.mainLeft,
        );
        expect(cardsGeometry.right).toBeLessThanOrEqual(
          cardsGeometry.mainRight,
        );
        await captureStepScreenshot(
          page,
          testInfo,
          `sections-responsive-${width}`,
        );
        continue;
      }

      const tableContainer = page
        .locator('[data-slot="table-container"]:visible')
        .first();
      await expect(tableContainer).toBeVisible();
      await expect(page.getByTestId("catalog-results-cards")).toBeHidden();

      const geometry = await tableContainer.evaluate((node) => {
        const container = node as HTMLElement;
        const table = container.querySelector("table");
        const cells = Array.from(
          container.querySelectorAll<HTMLElement>("th, td"),
        );
        if (!table || cells.length === 0)
          throw new Error("Sections table geometry missing");

        const containerBox = container.getBoundingClientRect();
        const overflowingCells = cells.flatMap((cell, index) =>
          cell.scrollWidth > cell.clientWidth + 1
            ? [
                {
                  clientWidth: cell.clientWidth,
                  index,
                  scrollWidth: cell.scrollWidth,
                  text: cell.textContent?.trim().replace(/\s+/g, " ") ?? "",
                },
              ]
            : [],
        );
        return {
          clientWidth: container.clientWidth,
          cellsWithinContainer: cells.every((cell) => {
            const cellBox = cell.getBoundingClientRect();
            return (
              cellBox.left >= containerBox.left - 1 &&
              cellBox.right <= containerBox.right + 1
            );
          }),
          overflowingCells,
          scrollWidth: container.scrollWidth,
          tableWidth: table.getBoundingClientRect().width,
        };
      });

      expect(geometry.scrollWidth).toBeLessThanOrEqual(
        geometry.clientWidth + 1,
      );
      expect(geometry.tableWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
      expect(geometry.cellsWithinContainer).toBe(true);
      expect(geometry.overflowingCells).toEqual([]);
      await captureStepScreenshot(
        page,
        testInfo,
        `sections-responsive-${width}`,
      );
    }

    expect(runtimeErrors).toEqual([]);
  });

  test("结构化筛选、高级语法与清除", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await useChineseLocale(page);
    await gotoAndWaitForReady(page, "/sections", {
      testInfo,
      screenshotLabel: "sections",
    });

    await page.getByRole("button", { name: /筛选|Filters/i }).click();
    const filterSheet = page.getByRole("dialog");
    await expect(filterSheet).toBeVisible();
    await filterSheet.getByRole("button", { name: "高级搜索语法" }).click();
    await expect(filterSheet.getByText("teacher:张三")).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(1);
    await captureStepScreenshot(page, testInfo, "sections-search-help");

    await filterSheet.getByLabel("教师").fill(DEV_SEED.teacher.nameCn);
    await filterSheet.getByLabel("课程代码").fill(DEV_SEED.course.code);
    await filterSheet.getByLabel("班级代码").fill(DEV_SEED.section.code);
    await filterSheet.getByLabel("学分").fill(String(DEV_SEED.section.credits));
    await filterSheet.getByLabel("排序字段").selectOption("code");
    await filterSheet.getByLabel("排序方向").selectOption("desc");
    await filterSheet.getByRole("button", { name: "应用筛选" }).click();

    await expect(filterSheet).toBeHidden();
    await expect(page).toHaveURL(
      new RegExp(`courseCode=${encodeURIComponent(DEV_SEED.course.code)}`),
    );
    await expect(page).toHaveURL(
      new RegExp(`sectionCode=${encodeURIComponent(DEV_SEED.section.code)}`),
    );
    await expect(page).toHaveURL(/sort=code/);
    await expect(page).toHaveURL(/order=desc/);
    await expect(visibleText(page, DEV_SEED.course.nameEn)).toBeVisible();
    await expect(visibleText(page, DEV_SEED.section.code)).toBeVisible();
    await expect(page.getByTestId("catalog-active-filters")).toContainText(
      DEV_SEED.teacher.nameCn,
    );
    await captureStepScreenshot(page, testInfo, "sections-structured-results");

    await page.getByRole("link", { name: /^清除$/ }).click();
    await expect(page).toHaveURL(/\/sections$/);
    await captureStepScreenshot(page, testInfo, "sections-clear");
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
