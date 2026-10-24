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
 * - Advanced syntax reference in the collection header
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
import { expect, type Page } from "@playwright/test";
import { test } from "../../../utils/catalog-search-fixture";
import { openCatalogColumnFilter } from "../../../utils/catalog-table-filters";
import { DEV_SEED } from "../../../utils/dev-seed";
import { visibleText } from "../../../utils/locators";
import {
  expectNoPageHorizontalOverflow,
  gotoAndWaitForReady,
} from "../../../utils/page-ready";
import { absoluteTestUrl } from "../../../utils/request-url";
import { observeSectionDetailNavigation } from "../../../utils/section-detail-navigation";
import { assertPageContract } from "../_shared/page-contract";

async function useChineseLocale(page: Page) {
  const response = await page.request.post("/api/account/preferences", {
    data: { locale: "zh-cn" },
  });
  expect(response.status()).toBe(200);
}

test.describe("/catalog/sections 教学班搜索页", () => {
  test("页面契约", { tag: "@Section/Web" }, async ({
    page,
    preferenceFlow,
    searchSection: _searchSection,
  }) => {
    await preferenceFlow.run(async () => {
      await assertPageContract(page, {
        routePath: "/catalog/sections",
      });
    });
  });

  test("无匹配教学班时显示明确空状态且不渲染结果链接", {
    tag: "@Section/Web",
  }, async ({ page, preferenceFlow, searchSection: _searchSection }) => {
    await preferenceFlow.run(async () => {
      for (const width of [1280, 320, 390]) {
        await page.setViewportSize({ width, height: 900 });
        await gotoAndWaitForReady(
          page,
          "/catalog/sections?search=e2e-no-matching-section-7f3c9a",
        );

        await expect(
          page
            .getByText(/未找到教学班|No sections found/i)
            .filter({ visible: true }),
        ).toBeVisible();
        await expect(
          page.locator("#main-content a[href^='/catalog/sections/']"),
        ).toHaveCount(0);
        await expect(
          page.getByRole("link", { name: /^(清除|Clear)$/i }),
        ).toBeVisible();
        await expectNoPageHorizontalOverflow(page);
        await page.getByRole("searchbox").fill(DEV_SEED.section.code);
        await page.getByRole("button", { name: /^(搜索|Search)$/ }).click();
        await expect(page).toHaveURL(
          (url) => url.searchParams.get("search") === DEV_SEED.section.code,
        );
        await expect(visibleText(page, DEV_SEED.section.code)).toBeVisible();
      }
    });
  });

  test("SSR 输出包含搜索查询", { tag: "@Section/Web" }, async ({
    baseURL,
    preferenceFlow,
    searchSection: _searchSection,
  }) => {
    await preferenceFlow.run(async () => {
      const response = await fetch(
        absoluteTestUrl(
          `/catalog/sections?search=${encodeURIComponent(DEV_SEED.section.code)}`,
          baseURL,
        ),
        { headers: preferenceFlow.headers },
      );
      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain('id="main-content"');
      expect(html).toContain(DEV_SEED.section.code);
    });
  });

  test("移动端卡片可点击并导航到详情", { tag: "@Section/Web" }, async ({
    page,
    preferenceFlow,
    searchSection: _searchSection,
  }) => {
    await preferenceFlow.run(async () => {
      const runtimeErrors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") runtimeErrors.push(message.text());
      });
      page.on("pageerror", (error) => runtimeErrors.push(error.message));

      await page.setViewportSize({ width: 375, height: 844 });
      await useChineseLocale(page);
      await gotoAndWaitForReady(
        page,
        `/catalog/sections?search=${encodeURIComponent(DEV_SEED.section.code)}`,
      );
      await expectNoPageHorizontalOverflow(page);
      await expect(
        page.locator(
          '[data-slot="collection-header"]:visible, [data-slot="table-controls-row"]:visible',
        ),
      ).toBeVisible();
      await expect(page.getByTestId("catalog-filter-sidebar")).toHaveCount(0);
      await expect(page.locator('[data-slot="results-summary"]')).toBeVisible();
      await expect(
        page.locator('[data-slot="active-filters"]:visible'),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "所有教学班" }),
      ).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("lang", "zh-cn");
      await expect(page).toHaveTitle(/教学班/);

      const header = page.locator('[data-slot="collection-header"]');
      const bounds = await header.boundingBox();
      if (!bounds) throw new Error("Missing collection header bounds");
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(375);
      const semester = await openCatalogColumnFilter(page, /学期|Semester/i);
      await expect(semester.getByLabel(/学期|Semester/i)).toBeVisible();
      await page.keyboard.press("Escape");

      const detailLink = page
        .locator("#main-content a[href^='/catalog/sections/']:visible")
        .first();
      await expect(detailLink).toBeVisible();
      const box = await detailLink.boundingBox();
      expect(box?.width ?? 0).toBeGreaterThan(250);
      expect(box?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(640);
      const expectSectionDetailReady = observeSectionDetailNavigation(
        page,
        preferenceFlow,
        DEV_SEED.section.jwId,
      );
      await detailLink.click();

      await expect(page).toHaveURL(/\/catalog\/sections\/\d+(?:\?.*)?$/);
      await expect(page.locator("#main-content")).toBeVisible();
      await expectSectionDetailReady();
      await expect(page.locator("vite-error-overlay")).toHaveCount(0);
      expect(runtimeErrors).toEqual([]);
    });
  });

  test("英文界面本地化教学班列表名称", { tag: "@Section/Web" }, async ({
    page,
    preferenceFlow,
    searchSection: _searchSection,
  }) => {
    await preferenceFlow.run(async () => {
      const runtimeErrors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") runtimeErrors.push(message.text());
      });
      page.on("pageerror", (error) => runtimeErrors.push(error.message));
      await page.setViewportSize({ width: 390, height: 844 });
      const localeResponse = await page.request.post(
        "/api/account/preferences",
        {
          data: { locale: "en-us" },
        },
      );
      expect(localeResponse.status()).toBe(200);

      await gotoAndWaitForReady(
        page,
        `/catalog/sections?search=${encodeURIComponent(DEV_SEED.section.code)}`,
      );

      await expect(visibleText(page, DEV_SEED.course.nameEn)).toBeVisible();
      await expect(visibleText(page, DEV_SEED.course.nameCn)).toBeVisible();
      await expect(visibleText(page, DEV_SEED.teacher.nameEn)).toBeVisible();
      await expect(visibleText(page, DEV_SEED.campus.nameEn)).toBeVisible();
      await expect(page.locator("vite-error-overlay")).toHaveCount(0);
      expect(runtimeErrors).toEqual([]);
    });
  });

  test("280 至 375 像素窄屏筛选与帮助不溢出", { tag: "@Section/Web" }, async ({
    page,
    preferenceFlow,
    searchSection: _searchSection,
  }) => {
    await preferenceFlow.run(async () => {
      await useChineseLocale(page);

      for (const width of [280, 320, 360, 375]) {
        await page.setViewportSize({ width, height: 900 });
        await gotoAndWaitForReady(
          page,
          `/catalog/sections?search=${encodeURIComponent(DEV_SEED.section.code)}`,
        );
        await expectNoPageHorizontalOverflow(page);

        const searchbox = page.getByRole("searchbox");
        await expect(searchbox).toBeVisible();
        const searchButton = page.getByRole("button", { name: /^搜索$/ });
        const searchBounds = await searchButton.boundingBox();
        expect(searchBounds?.height ?? 0).toBeGreaterThanOrEqual(44);
        for (const [column, fields] of [
          ["学期", ["学期"]],
          ["教师", ["教师"]],
          ["课程名称", ["课程代码", "课程类别", "教育层次", "课程类型"]],
          ["教学班代码", ["教学班代码"]],
          ["校区", ["校区"]],
          ["院系", ["院系"]],
          ["学分", ["学分"]],
        ] as const) {
          const filter = await openCatalogColumnFilter(page, column);
          for (const label of fields)
            await expect(
              filter.getByLabel(label, { exact: true }),
            ).toBeVisible();
          const bounds = await filter.boundingBox();
          if (!bounds) throw new Error("Missing column filter bounds");
          expect(bounds.x).toBeGreaterThanOrEqual(0);
          expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
          await page.keyboard.press("Escape");
        }
        const filterSheet = await openCatalogColumnFilter(page, "高级搜索语法");
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

        await page.keyboard.press("Escape");
        await expect(filterSheet).toBeHidden();
        await expect(searchbox).toBeVisible();
      }
    });
  });

  test("中文目录在桌面宽度下不裁切或横向溢出", { tag: "@Section/Web" }, async ({
    page,
    preferenceFlow,
    searchSection: _searchSection,
  }) => {
    await preferenceFlow.run(async () => {
      const runtimeErrors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") runtimeErrors.push(message.text());
      });
      page.on("pageerror", (error) => runtimeErrors.push(error.message));

      await useChineseLocale(page);
      for (const width of [1024, 1280, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await gotoAndWaitForReady(page, "/catalog/sections");

        await expect(page.locator("html")).toHaveAttribute("lang", "zh-cn");
        await expect(page).toHaveTitle(/教学班/);
        await expect(page.locator("vite-error-overlay")).toHaveCount(0);
        await expect(
          page.locator(
            '[data-slot="collection-header"]:visible, [data-slot="table-controls-row"]:visible',
          ),
        ).toBeVisible();
        await expect(page.getByTestId("catalog-filter-sidebar")).toHaveCount(0);

        const documentGeometry = await page.evaluate(() => ({
          clientWidth: document.documentElement.clientWidth,
          scrollbarGutter: getComputedStyle(document.documentElement)
            .scrollbarGutter,
          scrollWidth: document.documentElement.scrollWidth,
        }));
        expect(documentGeometry.scrollWidth).toBeLessThanOrEqual(
          documentGeometry.clientWidth,
        );
        expect(documentGeometry.scrollbarGutter).toBe("stable");

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
          continue;
        }

        const tableContainer = page
          .locator('[data-slot="table-container"]:visible')
          .first();
        await expect(tableContainer).toBeVisible();
        await expect(page.getByTestId("catalog-results-cards")).toBeHidden();

        const geometry = await tableContainer.evaluate((node) => {
          const container = node.parentElement as HTMLElement;
          const results = container.closest<HTMLElement>("section");
          const table = container.querySelector("table");
          const headerCells = Array.from(
            container.querySelectorAll<HTMLTableCellElement>(
              "thead th:not([colspan])",
            ),
          );
          const firstRowCells = Array.from(
            container.querySelectorAll<HTMLTableCellElement>(
              "tbody tr:first-child td",
            ),
          );
          const cells = Array.from(
            container.querySelectorAll<HTMLElement>("th, td"),
          );
          if (
            !results ||
            !table ||
            cells.length === 0 ||
            headerCells.length !== firstRowCells.length
          )
            throw new Error("Sections table geometry missing");

          const containerBox = container.getBoundingClientRect();
          const resultsStyle = getComputedStyle(results);
          const columnAlignment = headerCells.map((header, index) => {
            const cell = firstRowCells[index];
            const target = cell?.querySelector<HTMLElement>("a") ?? cell;
            if (!cell || !target)
              throw new Error("Sections table column content missing");
            const headerStyle = getComputedStyle(header);
            const targetStyle = getComputedStyle(target);
            const headerBox = header.getBoundingClientRect();
            const targetBox = target.getBoundingClientRect();
            const rightAligned = headerStyle.textAlign === "right";
            const headerEdge = rightAligned
              ? headerBox.right - Number.parseFloat(headerStyle.paddingRight)
              : headerBox.left + Number.parseFloat(headerStyle.paddingLeft);
            const cellEdge = rightAligned
              ? targetBox.right - Number.parseFloat(targetStyle.paddingRight)
              : targetBox.left + Number.parseFloat(targetStyle.paddingLeft);
            return {
              alignment: headerStyle.textAlign,
              offset: Math.abs(headerEdge - cellEdge),
            };
          });
          const rowTextCenters = [0, 1, 3, 4, 5, 6].map((index) => {
            const cell = firstRowCells[index];
            const walker = document.createTreeWalker(
              cell,
              NodeFilter.SHOW_TEXT,
            );
            let text = walker.nextNode();
            while (text) {
              if (text.textContent?.trim()) {
                const range = document.createRange();
                range.selectNodeContents(text);
                const box = range.getBoundingClientRect();
                if (box.width && box.height) return box.y + box.height / 2;
              }
              text = walker.nextNode();
            }
            throw new Error("Missing visible section cell text");
          });
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
            columnAlignment,
            rowTextCenters,
            cellsWithinContainer: cells.every((cell) => {
              const cellBox = cell.getBoundingClientRect();
              return (
                cellBox.left >= containerBox.left - 1 &&
                cellBox.right <= containerBox.right + 1
              );
            }),
            overflowingCells,
            resultsBackgroundIsTransparent:
              resultsStyle.backgroundColor.replaceAll(" ", "") ===
                "rgba(0,0,0,0)" ||
              resultsStyle.backgroundColor === "transparent",
            resultsBorderRadius: Math.max(
              ...[
                resultsStyle.borderTopLeftRadius,
                resultsStyle.borderTopRightRadius,
                resultsStyle.borderBottomRightRadius,
                resultsStyle.borderBottomLeftRadius,
              ].map(Number.parseFloat),
            ),
            resultsBorderWidth: Math.max(
              ...[
                resultsStyle.borderTopWidth,
                resultsStyle.borderRightWidth,
                resultsStyle.borderBottomWidth,
                resultsStyle.borderLeftWidth,
              ].map(Number.parseFloat),
            ),
            resultsOverflowX: resultsStyle.overflowX,
            resultsOverflowY: resultsStyle.overflowY,
            summaryIsDirectChild:
              results.querySelector(
                ":scope > [data-slot='results-summary']",
              ) !== null,
            scrollWidth: container.scrollWidth,
            tableWidth: table.getBoundingClientRect().width,
          };
        });

        expect(geometry.scrollWidth).toBeLessThanOrEqual(
          geometry.clientWidth + 1,
        );
        expect(geometry.tableWidth).toBeLessThanOrEqual(
          geometry.clientWidth + 1,
        );
        expect(geometry.cellsWithinContainer).toBe(true);
        expect(
          geometry.columnAlignment.map((column) => column.alignment),
        ).toEqual(["left", "left", "left", "left", "right", "right", "left"]);
        expect(
          Math.max(...geometry.columnAlignment.map((column) => column.offset)),
        ).toBeLessThanOrEqual(1);
        const sectionCode = page
          .locator('table:visible [data-slot="catalog-code"]')
          .first();
        await expect(sectionCode).toBeVisible();
        await expect(
          sectionCode.locator('xpath=ancestor::*[@data-slot="badge"]'),
        ).toHaveCount(0);
        expect(geometry.resultsBackgroundIsTransparent).toBe(true);
        expect(geometry.resultsBorderRadius).toBe(0);
        expect(geometry.resultsBorderWidth).toBe(0);
        expect(geometry.resultsOverflowX).toBe("visible");
        expect(geometry.resultsOverflowY).toBe("visible");
        expect(geometry.summaryIsDirectChild).toBe(true);
        expect(geometry.overflowingCells).toEqual([]);
        expect(
          Math.max(...geometry.rowTextCenters) -
            Math.min(...geometry.rowTextCenters),
        ).toBeLessThanOrEqual(1);
      }

      expect(runtimeErrors).toEqual([]);
    });
  });

  test("结构化筛选、高级语法与清除", { tag: "@Section/Web" }, async ({
    page,
    preferenceFlow,
    searchSection: _searchSection,
  }) => {
    await preferenceFlow.run(async () => {
      await page.setViewportSize({ width: 320, height: 900 });
      await useChineseLocale(page);
      await gotoAndWaitForReady(page, "/catalog/sections");

      const help = await openCatalogColumnFilter(page, "高级搜索语法");
      await expect(help.getByText("teacher:张三")).toBeVisible();
      await page.keyboard.press("Escape");
      for (const [column, label, name, value] of [
        ["教师", "教师", "teacher", DEV_SEED.teacher.nameCn],
        ["课程名称", "课程代码", "courseCode", DEV_SEED.course.code],
        ["教学班代码", "教学班代码", "sectionCode", DEV_SEED.section.code],
        ["学分", "学分", "credits", String(DEV_SEED.section.credits)],
      ]) {
        const filter = await openCatalogColumnFilter(page, column);
        await filter.getByLabel(label, { exact: true }).fill(value);
        await filter.getByRole("button", { name: "应用筛选" }).click();
        await expect(filter).toBeHidden();
        await expect(page).toHaveURL(
          (url) => url.searchParams.get(name) === value,
        );
      }
      const sorting = await openCatalogColumnFilter(page, "教学班代码");
      await sorting.getByRole("link", { name: "降序" }).click();
      await expect(sorting).toBeHidden();
      await expect(page).toHaveURL(
        new RegExp(`courseCode=${encodeURIComponent(DEV_SEED.course.code)}`),
      );
      await expect(page).toHaveURL(
        new RegExp(`sectionCode=${encodeURIComponent(DEV_SEED.section.code)}`),
      );
      await expect(page).toHaveURL(/sort=code/);
      await expect(page).toHaveURL(/order=desc/);
      await expect(visibleText(page, DEV_SEED.course.nameCn)).toBeVisible();
      await expect(visibleText(page, DEV_SEED.section.code)).toBeVisible();
      await expect(
        page.locator('[data-slot="active-filters"]:visible'),
      ).toContainText(DEV_SEED.teacher.nameCn);
      await page.getByRole("link", { name: /^清除$/ }).click();
      await expect(page).toHaveURL(/\/catalog\/sections$/);
    });
  });

  test("学期筛选保留种子数据结果", { tag: "@Section/Web" }, async ({
    page,
    preferenceFlow,
    searchSection: _searchSection,
  }) => {
    await preferenceFlow.run(async () => {
      const filter = {
        semesterId: _searchSection.semester.id,
        semesterName: _searchSection.semester.nameCn,
      };
      if (!filter.semesterName) {
        throw new Error(
          "Expected the seeded section to have a semester fixture",
        );
      }

      await gotoAndWaitForReady(
        page,
        `/catalog/sections?semesterId=${filter.semesterId}`,
      );
      await expect(page).toHaveURL(
        new RegExp(`semesterId=${filter.semesterId}`),
      );
      await expect(visibleText(page, DEV_SEED.course.nameEn)).toBeVisible();
      await expect(visibleText(page, DEV_SEED.section.code)).toBeVisible();
    });
  });
});
