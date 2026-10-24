import { expect, type Page } from "@playwright/test";
import type { TestPrismaClient } from "../../../../shared/prisma";
import {
  applyCatalogFilters,
  expectCatalogFilterValue,
  openCatalogColumnFilter,
  setCatalogFilterValue as setDraft,
} from "../../../utils/catalog-table-filters";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { test } from "../../../utils/personal-preferences-fixture";

type FilterCase = {
  route: string;
  search: string;
  result: string;
  filters: Record<string, string>;
  columns: { label: RegExp; fields: string[] }[];
};

async function cases(db: TestPrismaClient): Promise<FilterCase[]> {
  return db.$transaction(async (db) => {
    const education = await db.educationLevel.create({
      data: { nameCn: "筛选培养层次", nameEn: "Filter education level" },
    });
    const category = await db.courseCategory.create({
      data: { nameCn: "筛选课程类别", nameEn: "Filter course category" },
    });
    const classType = await db.classType.create({
      data: { nameCn: "筛选教学班类型", nameEn: "Filter class type" },
    });
    const department = await db.department.create({
      data: {
        jwId: 1,
        code: "FILTER-DEPT",
        nameCn: "筛选院系",
        nameEn: "Filter department",
      },
    });
    const campus = await db.campus.create({
      data: { jwId: 1, nameCn: "筛选校区", nameEn: "Filter campus" },
    });
    const semester = await db.semester.create({
      data: { jwId: 1, code: "FILTER-TERM", nameCn: "2026年秋季学期" },
    });
    const course = await db.course.create({
      data: {
        jwId: 1_700_000_000,
        code: "FILTER-COURSE",
        nameCn: "独立筛选课程",
        nameEn: "Independent filter course",
        educationLevelId: education.id,
        categoryId: category.id,
        classTypeId: classType.id,
      },
    });
    const teacher = await db.teacher.create({
      data: {
        jwId: 1_700_000_000,
        code: "FILTER-TEACHER",
        nameCn: "独立筛选教师",
        nameEn: "Independent filter teacher",
        departmentId: department.id,
      },
    });
    const section = await db.section.create({
      data: {
        jwId: 1_700_000_000,
        code: "FILTER-COURSE.01",
        courseId: course.id,
        semesterId: semester.id,
        campusId: campus.id,
        openDepartmentId: department.id,
        credits: 3.5,
        teachers: { connect: { id: teacher.id } },
      },
    });
    if (!teacher.code)
      throw new Error("Filter fixture teacher requires a public code");
    const courseFilters = {
      educationLevelId: String(course.educationLevelId),
      categoryId: String(course.categoryId),
      classTypeId: String(course.classTypeId),
    };
    return [
      {
        route: "/catalog/courses",
        search: course.code,
        result: course.nameCn,
        filters: courseFilters,
        columns: [
          {
            label: /^(教育层次|Education Level)$/i,
            fields: ["educationLevelId"],
          },
          { label: /^(类别|Category)$/i, fields: ["categoryId"] },
          { label: /^(课程类型|Class Type)$/i, fields: ["classTypeId"] },
        ],
      },
      {
        route: "/catalog/teachers",
        search: teacher.code,
        result: teacher.nameCn,
        filters: { departmentId: String(teacher.departmentId) },
        columns: [{ label: /^(院系|Department)$/i, fields: ["departmentId"] }],
      },
      {
        route: "/catalog/sections",
        search: course.code,
        result: course.nameCn,
        filters: {
          semesterId: String(section.semesterId),
          teacher: teacher.nameCn,
          courseCode: course.code,
          sectionCode: section.code,
          campusId: String(section.campusId),
          departmentId: String(section.openDepartmentId),
          credits: String(section.credits),
          ...courseFilters,
        },
        columns: [
          { label: /^(学期|Semester)$/i, fields: ["semesterId"] },
          { label: /^(课程代码|Course Code)$/i, fields: ["courseCode"] },
          { label: /^(课程类别|Course Category)$/i, fields: ["categoryId"] },
          {
            label: /^(教育层次|Education Level)$/i,
            fields: ["educationLevelId"],
          },
          { label: /^(课程类型|Class Type)$/i, fields: ["classTypeId"] },
          { label: /^(教学班代码|Section Code)$/i, fields: ["sectionCode"] },
          { label: /^(教师|Teachers)$/i, fields: ["teacher"] },
          { label: /^(学分|Credits)$/i, fields: ["credits"] },
          { label: /^(校区|Campus)$/i, fields: ["campusId"] },
          { label: /^(院系|Department)$/i, fields: ["departmentId"] },
        ],
      },
    ];
  });
}

async function resultText(page: Page) {
  return page.locator("#main-content").innerText();
}

for (const domain of ["Course", "Section", "Teacher"] as const) {
  test(`ui.list-table-3 ${domain}`, { tag: `@${domain}/Web` }, async ({
    page,
    preferenceFlow,
    isolatedWorker,
  }) => {
    await preferenceFlow.run(async () => {
      const fixture = (await cases(isolatedWorker.database.owner)).find(
        (item) => item.route === `/catalog/${domain.toLowerCase()}s`,
      );
      if (!fixture) throw new Error("Missing catalog fixture");
      for (const width of [390, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        // Header controls remain reachable even when the search returns nothing.
        await gotoAndWaitForReady(
          page,
          `${fixture.route}?search=unmatched-filter-result`,
        );
        const search = page.getByRole("searchbox");
        await expect(search).toBeVisible();
        expect(
          await search.evaluate((node) =>
            Boolean(node.closest('[data-slot="table-filter-toolbar"]')),
          ),
        ).toBe(true);
        for (const column of fixture.columns) {
          const dialog = await openCatalogColumnFilter(page, column.label);
          await expect(page.getByRole("dialog")).toHaveCount(1);
          await expect(dialog.locator("form")).toHaveCount(0);
          for (const name of column.fields) {
            const field = dialog.locator(`[data-filter-field="${name}"]`);
            await expect(field).toBeVisible();
            const inputs = field.locator(
              'input:not([type="hidden"]), button[role="checkbox"]',
            );
            for (const input of await inputs.all())
              await expect(input).toHaveAccessibleName(/.+/);
          }
          await expect(
            dialog.getByRole("button", { name: /应用筛选|Apply filters/i }),
          ).toHaveCount(0);
          await expect(
            page.getByRole("button", { name: /应用筛选|Apply filters/i }),
          ).toHaveCount(1);
          await page.keyboard.press("Escape");
          await expect(dialog).toBeHidden();
          await expect(
            page
              .locator('[data-slot="table-column-header"]')
              .getByRole("button", {
                name: column.label,
              }),
          ).toBeFocused();
        }
        await search.fill(fixture.search);
        await applyCatalogFilters(page);
        await expect(page.locator("#main-content")).toContainText(
          fixture.result,
        );
        await page.keyboard.press("ControlOrMeta+Shift+K");
        await expect(search).toBeFocused();
      }
    });
  });

  test(`ui.list-table-4 ${domain}`, { tag: `@${domain}/Web` }, async ({
    page,
    preferenceFlow,
    isolatedWorker,
  }) => {
    await preferenceFlow.run(async () => {
      const fixture = (await cases(isolatedWorker.database.owner)).find(
        (item) => item.route === `/catalog/${domain.toLowerCase()}s`,
      );
      if (!fixture) throw new Error("Missing catalog fixture");
      const query = new URLSearchParams({
        search: fixture.search,
        ...fixture.filters,
      });
      await gotoAndWaitForReady(page, `${fixture.route}?${query}`);
      const beforeUrl = page.url();
      const beforeResults = await resultText(page);
      expect(beforeResults).toContain(fixture.result);
      for (const column of fixture.columns) {
        for (const dismissal of ["outside", "escape"]) {
          const dialog = await openCatalogColumnFilter(page, column.label);
          for (const name of column.fields) {
            await expectCatalogFilterValue(
              dialog,
              name,
              dismissal === "outside" ? fixture.filters[name] : "",
            );
            await setDraft(dialog, name, "");
          }
          if (dismissal === "outside")
            await page.getByRole("heading", { level: 1 }).click();
          else await page.keyboard.press("Escape");
          await expect(dialog).toBeHidden();
          expect(page.url()).toBe(beforeUrl);
          expect(await resultText(page)).toBe(beforeResults);
        }
        const restored = await openCatalogColumnFilter(page, column.label);
        for (const name of column.fields)
          await expectCatalogFilterValue(restored, name, "");
        await page.keyboard.press("Escape");
        await expect(restored).toBeHidden();
      }
    });
  });

  test(`ui.list-table-5 ${domain}`, { tag: `@${domain}/Web` }, async ({
    page,
    preferenceFlow,
    isolatedWorker,
  }) => {
    await preferenceFlow.run(async () => {
      const fixture = (await cases(isolatedWorker.database.owner)).find(
        (item) => item.route === `/catalog/${domain.toLowerCase()}s`,
      );
      if (!fixture) throw new Error("Missing catalog fixture");
      await gotoAndWaitForReady(
        page,
        `${fixture.route}?${new URLSearchParams({ search: fixture.search, page: "2" })}`,
      );
      const applied: Record<string, string> = { search: fixture.search };
      for (const column of fixture.columns) {
        const dialog = await openCatalogColumnFilter(page, column.label);
        for (const name of column.fields) {
          await setDraft(dialog, name, fixture.filters[name]);
          applied[name] = fixture.filters[name];
        }
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
      }
      await applyCatalogFilters(page);
      await expect
        .poll(() => Object.fromEntries(new URL(page.url()).searchParams))
        .toEqual(applied);
      await expect(page.locator("#main-content")).toContainText(fixture.result);
      const changedSearch = fixture.result;
      await page.getByRole("searchbox").fill(changedSearch);
      await applyCatalogFilters(page);
      await expect
        .poll(() => Object.fromEntries(new URL(page.url()).searchParams))
        .toEqual({ ...applied, search: changedSearch });
      await expect(page.locator("#main-content")).toContainText(fixture.result);
      await page.goBack();
      await expect
        .poll(() => Object.fromEntries(new URL(page.url()).searchParams))
        .toEqual(applied);
      await page.goForward();
      await expect(page.getByRole("searchbox")).toHaveValue(changedSearch);
    });
  });
}

test("section sorting shares the page filter draft and applies once", {
  tag: "@Section/Web",
}, async ({ page, preferenceFlow, isolatedWorker }) => {
  await preferenceFlow.run(async () => {
    const fixture = (await cases(isolatedWorker.database.owner)).find(
      (item) => item.route === "/catalog/sections",
    );
    if (!fixture) throw new Error("Missing section fixture");
    const sorts = [
      { key: "semester", label: /^(学期|Semester)$/i },
      { key: "course", label: /^(课程名称|Course Name)$/i },
      { key: "code", label: /^(教学班代码|Section Code)$/i },
      { key: "teacher", label: /^(教师|Teachers)$/i },
      { key: "credits", label: /^(学分|Credits)$/i },
      { key: "capacity", label: /^(容量|Capacity)$/i },
      { key: "campus", label: /^(校区|Campus)$/i },
    ];
    for (const column of sorts) {
      const applied = { search: fixture.search, ...fixture.filters };
      await gotoAndWaitForReady(
        page,
        `${fixture.route}?${new URLSearchParams({ ...applied, page: "2" })}`,
      );
      const dialog = await openCatalogColumnFilter(page, column.label);
      const fields =
        fixture.columns.find(
          (entry) => entry.label.source === column.label.source,
        )?.fields ?? [];
      for (const name of fields)
        await setDraft(dialog, name, fixture.filters[name]);
      await dialog.getByRole("radio", { name: /^(降序|Descending)$/i }).click();
      await applyCatalogFilters(page);
      await expect
        .poll(() => Object.fromEntries(new URL(page.url()).searchParams))
        .toEqual({ ...applied, sort: column.key, order: "desc" });
      await expect(page.locator("#main-content")).toContainText(fixture.result);
      if ((page.viewportSize()?.width ?? 0) >= 1280)
        await expect(
          page.getByRole("columnheader", { name: column.label }),
        ).toHaveAttribute("aria-sort", "descending");
      const sorted = await openCatalogColumnFilter(page, column.label);
      await sorted
        .getByRole("radio", { name: /^(默认顺序|Default order)$/i })
        .click();
      await applyCatalogFilters(page);
      await expect
        .poll(() => Object.fromEntries(new URL(page.url()).searchParams))
        .toEqual(applied);
    }
  });
});
