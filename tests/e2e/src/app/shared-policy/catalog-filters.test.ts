import { expect, type Locator, type Page } from "@playwright/test";
import type { TestPrismaClient } from "../../../../shared/prisma";
import { openCatalogColumnFilter } from "../../../utils/catalog-table-filters";
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
          {
            label: /^(课程名称|Course Name)$/i,
            fields: [
              "courseCode",
              "categoryId",
              "educationLevelId",
              "classTypeId",
            ],
          },
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

async function setDraft(dialog: Locator, name: string, value: string) {
  const field = dialog.locator(`[name="${name}"]`);
  if (await field.evaluate((element) => element.tagName === "SELECT")) {
    await field.selectOption(value);
  } else {
    await field.fill(value);
  }
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
            Boolean(node.closest('thead, [data-slot="collection-header"]')),
          ),
        ).toBe(true);
        for (const column of fixture.columns) {
          const dialog = await openCatalogColumnFilter(page, column.label);
          await expect(page.getByRole("dialog")).toHaveCount(1);
          await expect(dialog.locator("form")).toHaveCount(1);
          const fields = dialog.locator(
            'select[name], input:not([type="hidden"])[name]',
          );
          expect(
            await fields.evaluateAll((nodes) =>
              nodes.map((node) => node.getAttribute("name")).sort(),
            ),
          ).toEqual([...column.fields].sort());
          for (const name of column.fields)
            await expect(
              dialog.locator(`[name="${name}"]`),
            ).toHaveAccessibleName(/.+/);
          await expect(
            dialog.getByRole("button", { name: /应用筛选|Apply filters/i }),
          ).toBeVisible();
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
        await page.getByRole("button", { name: /^(搜索|Search)$/ }).click();
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
            await expect(dialog.locator(`[name="${name}"]`)).toHaveValue(
              fixture.filters[name],
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
          await expect(restored.locator(`[name="${name}"]`)).toHaveValue(
            fixture.filters[name],
          );
        await page.keyboard.press("Escape");
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
        await dialog
          .getByRole("button", { name: /应用筛选|Apply filters/i })
          .click();
        await expect(dialog).toBeHidden();
        await expect
          .poll(() => Object.fromEntries(new URL(page.url()).searchParams))
          .toEqual(applied);
        await expect(page.locator("#main-content")).toContainText(
          fixture.result,
        );
      }
      const changedSearch = fixture.result;
      await page.getByRole("searchbox").fill(changedSearch);
      await page.getByRole("button", { name: /^(搜索|Search)$/ }).click();
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

test("section column sorting preserves applied filters and discards unapplied drafts", {
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
      for (const name of fields) await setDraft(dialog, name, "");
      await dialog.getByRole("link", { name: /^(降序|Descending)$/i }).click();
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
        .getByRole("link", { name: /^(默认顺序|Default order)$/i })
        .click();
      await expect
        .poll(() => Object.fromEntries(new URL(page.url()).searchParams))
        .toEqual(applied);
    }
  });
});
