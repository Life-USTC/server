/**
 * E2E tests for /teachers — Teacher Search Page
 *
 * ## Data Represented
 * - Teachers with code, name (cn/en), department, title, sections
 * - Seed teacher: DEV_SEED.teacher (dynamic id, resolved via search)
 * - Department filter uses this test’s private teacher and department
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
 * - Department fixture is independently created for each case
 * - Search and clear controls must be present
 */
import { expect } from "@playwright/test";
import { test } from "../../../utils/catalog-search-fixture";
import {
  applyCatalogFilters,
  expectCatalogTableFilters,
  openCatalogColumnFilter,
  setCatalogFilterValue,
} from "../../../utils/catalog-table-filters";
import { DEV_SEED } from "../../../utils/dev-seed";
import { visibleText } from "../../../utils/locators";
import {
  expectNoPageHorizontalOverflow,
  gotoAndWaitForReady,
} from "../../../utils/page-ready";
import { absoluteTestUrl } from "../../../utils/request-url";
import { assertPageContract } from "../_shared/page-contract";

test.describe("/catalog/teachers", () => {
  test("页面契约", { tag: "@Teacher/Web" }, async ({
    page,
    preferenceFlow,
    searchTeacher: _searchTeacher,
  }) => {
    await preferenceFlow.run(async () => {
      await assertPageContract(page, {
        routePath: "/catalog/teachers",
      });
    });
  });

  test("SSR 输出包含搜索参数", { tag: "@Teacher/Web" }, async ({
    baseURL,
    preferenceFlow,
    searchTeacher: _searchTeacher,
  }) => {
    await preferenceFlow.run(async () => {
      const response = await fetch(
        absoluteTestUrl(
          `/catalog/teachers?search=${encodeURIComponent(DEV_SEED.teacher.nameCn)}`,
          baseURL,
        ),
        { headers: preferenceFlow.headers },
      );
      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain('id="main-content"');
      expect(html).toContain(DEV_SEED.teacher.nameCn);
    });
  });

  test("无匹配教师时显示明确空状态且不渲染结果链接", {
    tag: "@Teacher/Web",
  }, async ({ page, preferenceFlow, searchTeacher: _searchTeacher }) => {
    await preferenceFlow.run(async () => {
      await gotoAndWaitForReady(
        page,
        "/catalog/teachers?search=e2e-no-matching-teacher-7f3c9a",
      );

      await expect(
        page
          .getByText(/未找到教师|No teachers found/i)
          .filter({ visible: true }),
      ).toBeVisible();
      await expect(
        page.locator("#main-content a[href^='/catalog/teachers/']"),
      ).toHaveCount(0);
      await expect(
        page.getByRole("link", { name: /^(清除|Clear)$/i }),
      ).toBeVisible();
    });
  });

  test("移动端卡片可点击并导航到详情", { tag: "@Teacher/Web" }, async ({
    page,
    preferenceFlow,
    searchTeacher: _searchTeacher,
  }) => {
    await preferenceFlow.run(async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await gotoAndWaitForReady(
        page,
        `/catalog/teachers?search=${encodeURIComponent(DEV_SEED.teacher.nameCn)}`,
      );
      await expectNoPageHorizontalOverflow(page);
      await expect(
        page.locator('[data-slot="table-filter-toolbar"]:visible'),
      ).toBeVisible();
      await expect(page.getByTestId("catalog-filter-sidebar")).toHaveCount(0);
      await expect(page.locator('[data-slot="results-summary"]')).toBeVisible();
      await expect(
        page.locator('[data-slot="active-filters"]:visible'),
      ).toBeVisible();
      await expectCatalogTableFilters(page, [/院系|Department/i]);

      const detailLink = page
        .locator("#main-content a[href^='/catalog/teachers/']:visible")
        .first();
      await expect(detailLink).toBeVisible();
      const box = await detailLink.boundingBox();
      expect(box?.width ?? 0).toBeGreaterThan(250);
      expect(box?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(640);
      await detailLink.click();

      await expect(page).toHaveURL(/\/catalog\/teachers\/\d+(?:\?.*)?$/);
      await expect(page.locator("#main-content")).toBeVisible();
    });
  });

  test("280 至 1440 像素通过列头提供教师筛选", {
    tag: "@Teacher/Web",
  }, async ({ page, preferenceFlow, searchTeacher: _searchTeacher }) => {
    await preferenceFlow.run(async () => {
      for (const width of [280, 320, 375, 1024, 1280, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await gotoAndWaitForReady(page, "/catalog/teachers");
        await expectCatalogTableFilters(page, [/院系|Department/i]);
        await expect(page.locator("vite-error-overlay")).toHaveCount(0);
        if (width === 280 || width === 375) {
        }
      }
    });
  });

  test("搜索和清除按钮可用", { tag: "@Teacher/Web" }, async ({
    page,
    preferenceFlow,
    searchTeacher: _searchTeacher,
  }) => {
    await preferenceFlow.run(async () => {
      await gotoAndWaitForReady(page, "/catalog/teachers");

      const searchbox = page.getByRole("searchbox").first();
      await expect(searchbox).toBeVisible();

      await searchbox.fill(DEV_SEED.teacher.nameCn);
      const searchButton = page.getByRole("button", {
        name: /^(应用筛选|Apply filters)$/i,
      });
      await expect(searchButton).toBeVisible();
      await searchButton.click();

      await expect(page).toHaveURL(/search=/);

      const clearLink = page
        .getByRole("link", { name: /^(清除|Clear)$/i })
        .first();
      await expect(clearLink).toBeVisible();
      await clearLink.click();
      await expect
        .poll(() => new URL(page.url()).searchParams.get("search"))
        .toBe(DEV_SEED.teacher.nameCn);
    });
  });

  test("院系筛选保留教师结果", { tag: "@Teacher/Web" }, async ({
    page,
    preferenceFlow,
    searchTeacher: _searchTeacher,
  }) => {
    await preferenceFlow.run(async () => {
      const filter = {
        departmentId: _searchTeacher.department.id,
        departmentName: _searchTeacher.department.nameCn,
      };
      if (!filter.departmentName) {
        throw new Error(
          "Expected the seeded teacher to have a department fixture",
        );
      }

      await gotoAndWaitForReady(page, "/catalog/teachers");
      await page.getByRole("searchbox").fill(DEV_SEED.teacher.nameCn);
      const filterDialog = await openCatalogColumnFilter(
        page,
        /院系|Department/i,
      );
      await setCatalogFilterValue(
        filterDialog,
        "departmentId",
        String(filter.departmentId),
      );
      await expect(page).not.toHaveURL(/departmentId=/);
      await applyCatalogFilters(page);
      await expect(filterDialog).toBeHidden();
      await expect(page).toHaveURL(
        new RegExp(`departmentId=${filter.departmentId}`),
      );
      await expect
        .poll(() => new URL(page.url()).searchParams.get("search"))
        .toBe(DEV_SEED.teacher.nameCn);
      await expect(visibleText(page, DEV_SEED.teacher.nameCn)).toBeVisible();
    });
  });

  test("teacher.list-hides-sparse-columns", { tag: "@Teacher/Web" }, async ({
    page,
    preferenceFlow,
    isolatedWorker,
  }) => {
    await preferenceFlow.run(async () => {
      const marker = crypto.randomUUID().slice(0, 8);
      const base = 1_800_000_000 + Math.floor(Math.random() * 100_000_000);
      const { teacher } = await preferenceFlow.prepare(() =>
        isolatedWorker.database.owner.$transaction(async (db) => {
          const department = await db.department.create({
            data: {
              code: marker,
              nameCn: `稀疏院系${marker}`,
              nameEn: `Sparse dept ${marker}`,
            },
          });
          const teacher = await db.teacher.create({
            data: {
              jwId: base,
              code: `SP-${marker}`,
              nameCn: `稀疏列教师${marker}`,
              nameEn: `Sparse columns ${marker}`,
              departmentId: department.id,
            },
          });
          const education = await db.educationLevel.create({
            data: { nameCn: `层次${marker}`, nameEn: `Level ${marker}` },
          });
          const course = await db.course.create({
            data: {
              jwId: base + 1,
              code: `SP-C-${marker}`,
              nameCn: `稀疏课程${marker}`,
              nameEn: `Sparse course ${marker}`,
              educationLevelId: education.id,
            },
          });
          const semester = await db.semester.create({
            data: {
              jwId: base + 2,
              code: marker,
              nameCn: "2026-2027学年第一学期",
            },
          });
          await db.section.create({
            data: {
              jwId: base + 3,
              code: "01",
              courseId: course.id,
              semesterId: semester.id,
              teachers: { connect: { id: teacher.id } },
              sectionTeachers: { create: { teacherId: teacher.id } },
            },
          });
          return { teacher };
        }),
      );

      await page.setViewportSize({ width: 1440, height: 900 });
      await gotoAndWaitForReady(
        page,
        `/catalog/teachers?search=${encodeURIComponent(teacher.nameCn)}`,
      );
      const table = page.locator("table:visible");
      await expect(table).toBeVisible();
      await expect(
        table.getByRole("columnheader", { name: /职称|Title/i }),
      ).toHaveCount(0);
      await expect(
        table.getByRole("columnheader", { name: /邮箱|Email/i }),
      ).toHaveCount(0);
      const countLink = table.getByTestId("teacher-section-count");
      await expect(countLink).toHaveText("1");
      await expect(countLink.locator("xpath=ancestor::a[1]")).toHaveAttribute(
        "href",
        `/catalog/teachers/${teacher.id}#sections`,
      );
      await page.setViewportSize({ width: 390, height: 900 });
      const mobileCount = page.locator(
        '[data-testid="teacher-section-count"]:visible',
      );
      await expect(mobileCount).toHaveText("1");
      await expect(mobileCount).toHaveAttribute(
        "href",
        `/catalog/teachers/${teacher.id}#sections`,
      );
    });
  });

  test("mixed title page still shows 未知 for empty titles", {
    tag: "@Teacher/Web",
  }, async ({ page, preferenceFlow, isolatedWorker }) => {
    await preferenceFlow.run(async () => {
      const marker = crypto.randomUUID().slice(0, 8);
      const base = 1_810_000_000 + Math.floor(Math.random() * 100_000_000);
      const { titled, untitled, title } = await preferenceFlow.prepare(() =>
        isolatedWorker.database.owner.$transaction(async (db) => {
          const department = await db.department.create({
            data: {
              code: marker,
              nameCn: `混合院系${marker}`,
              nameEn: `Mixed dept ${marker}`,
            },
          });
          const title = await db.teacherTitle.create({
            data: {
              jwId: base,
              code: marker,
              nameCn: `混合职称${marker}`,
              nameEn: `Mixed title ${marker}`,
            },
          });
          const titled = await db.teacher.create({
            data: {
              jwId: base + 1,
              code: `MX-T-${marker}`,
              nameCn: `有职称教师${marker}`,
              nameEn: `Titled teacher ${marker}`,
              departmentId: department.id,
              teacherTitleId: title.id,
            },
          });
          const untitled = await db.teacher.create({
            data: {
              jwId: base + 2,
              code: `MX-U-${marker}`,
              nameCn: `无职称教师${marker}`,
              nameEn: `Untitled teacher ${marker}`,
              departmentId: department.id,
            },
          });
          return { titled, untitled, title };
        }),
      );

      await page.setViewportSize({ width: 1440, height: 900 });
      await gotoAndWaitForReady(
        page,
        `/catalog/teachers?search=${encodeURIComponent(marker)}`,
      );
      const table = page.locator("table:visible");
      await expect(
        table.getByRole("columnheader", { name: /职称|Title/i }),
      ).toHaveCount(1);
      const untitledRow = table
        .locator("tbody tr")
        .filter({ hasText: untitled.nameCn });
      await expect(untitledRow.locator("td").nth(3)).toHaveText(/未知|Unknown/);
      await expect(
        table
          .locator("tbody tr")
          .filter({ hasText: titled.nameCn })
          .locator("td")
          .nth(3),
      ).toHaveText(
        (await page.locator("html").getAttribute("lang")) === "en-us"
          ? `Mixed title ${marker}`
          : title.nameCn,
      );
    });
  });
});
