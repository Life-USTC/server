import { expect, type Locator, type Page, test } from "@playwright/test";
import { openCatalogFilterSheet } from "../../../utils/catalog-filter-sheet";
import { DEV_SEED } from "../../../utils/dev-seed";
import { withE2ePrisma } from "../../../utils/e2e-db/prisma";
import { gotoAndWaitForReady } from "../../../utils/page-ready";

async function cases() {
  return withE2ePrisma(async (db) => {
    const course = await db.course.findUniqueOrThrow({
      where: { jwId: DEV_SEED.course.jwId },
    });
    const section = await db.section.findUniqueOrThrow({
      where: { jwId: DEV_SEED.section.jwId },
    });
    const teacher = await db.teacher.findFirstOrThrow({
      where: { code: DEV_SEED.teacher.code },
    });
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

test("ui.list-table-3", async ({ page }) => {
  for (const fixture of await cases()) {
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

test("ui.list-table-4", async ({ page }) => {
  for (const fixture of await cases()) {
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

test("ui.list-table-5", async ({ page }) => {
  for (const fixture of await cases()) {
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
