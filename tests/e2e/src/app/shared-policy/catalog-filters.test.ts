import { expect, type Locator, type Page } from "@playwright/test";
import type { TestPrismaClient } from "../../../../shared/prisma";
import { openCatalogFilterSheet } from "../../../utils/catalog-filter-sheet";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { test } from "../../../utils/personal-preferences-fixture";

async function cases(db: TestPrismaClient) {
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
      },
      {
        route: "/catalog/teachers",
        search: teacher.code,
        result: teacher.nameCn,
        filters: { departmentId: String(teacher.departmentId) },
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
          sort: "course",
          order: "desc",
        },
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

test("ui.list-table-3", async ({ page, preferenceFlow, isolatedWorker }) => {
  await preferenceFlow.run(async () => {
    for (const fixture of await cases(isolatedWorker.database.owner)) {
      await gotoAndWaitForReady(page, fixture.route);
      const dialog = await openCatalogFilterSheet(page);
      await expect(page.getByRole("dialog")).toHaveCount(1);
      await expect(dialog).toHaveAccessibleName(/筛选|Filter/i);
      await expect(dialog.locator("form")).toHaveCount(1);
      const fields = dialog.locator(
        'select[name], input:not([type="hidden"])[name]',
      );
      expect(
        await fields.evaluateAll((nodes) =>
          nodes.map((node) => node.getAttribute("name")).sort(),
        ),
      ).toEqual(Object.keys(fixture.filters).sort());
      for (const name of Object.keys(fixture.filters)) {
        await expect(dialog.locator(`[name="${name}"]`)).toHaveAccessibleName(
          /.+/,
        );
      }
      await expect(
        dialog.getByRole("button", { name: /应用筛选|Apply filters/i }),
      ).toBeVisible();
      const close = dialog.getByRole("button", { name: "Close", exact: true });
      await expect(close).toBeVisible();
      await close.click();
      await expect(dialog).toBeHidden();
    }
  });
});

test("ui.list-table-4", async ({ page, preferenceFlow, isolatedWorker }) => {
  await preferenceFlow.run(async () => {
    for (const fixture of await cases(isolatedWorker.database.owner)) {
      const query = new URLSearchParams({
        search: fixture.search,
        ...fixture.filters,
      });
      await gotoAndWaitForReady(page, `${fixture.route}?${query}`);
      const beforeUrl = page.url();
      const beforeResults = await resultText(page);
      expect(beforeResults).toContain(fixture.result);
      for (const dismissal of ["button", "escape"]) {
        const dialog = await openCatalogFilterSheet(page);
        for (const [name, value] of Object.entries(fixture.filters)) {
          await expect(dialog.locator(`[name="${name}"]`)).toHaveValue(value);
          await setDraft(
            dialog,
            name,
            name === "sort" ? "code" : name === "order" ? "asc" : "",
          );
        }
        if (dismissal === "button")
          await dialog
            .getByRole("button", { name: "Close", exact: true })
            .click();
        else await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
        expect(page.url()).toBe(beforeUrl);
        expect(await resultText(page)).toBe(beforeResults);
      }
    }
  });
});

test("ui.list-table-5", async ({ page, preferenceFlow, isolatedWorker }) => {
  await preferenceFlow.run(async () => {
    for (const fixture of await cases(isolatedWorker.database.owner)) {
      await gotoAndWaitForReady(
        page,
        `${fixture.route}?${new URLSearchParams({ search: fixture.search, page: "2" })}`,
      );
      const dialog = await openCatalogFilterSheet(page);
      for (const [name, value] of Object.entries(fixture.filters))
        await setDraft(dialog, name, value);
      await dialog
        .getByRole("button", { name: /应用筛选|Apply filters/i })
        .click();
      await expect(dialog).toBeHidden();
      await expect
        .poll(() => Object.fromEntries(new URL(page.url()).searchParams))
        .toEqual({ search: fixture.search, ...fixture.filters });
      expect(await resultText(page)).toContain(fixture.result);
      const changedSearch = fixture.result;
      await page.getByRole("searchbox").fill(changedSearch);
      await page.getByRole("button", { name: /^(搜索|Search)$/ }).click();
      await expect
        .poll(() => Object.fromEntries(new URL(page.url()).searchParams))
        .toEqual({ search: changedSearch, ...fixture.filters });
      expect(await resultText(page)).toContain(fixture.result);
    }
  });
});
