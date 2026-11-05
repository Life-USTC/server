import { expect } from "@playwright/test";
import { createDeferred } from "../../../../shared/deferred";
import {
  applyCatalogFilters,
  openCatalogColumnFilter,
} from "../../../utils/catalog-table-filters";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { test } from "../../../utils/personal-preferences-fixture";

for (const domain of ["Section", "Course", "Teacher"] as const) {
  for (const width of [1280, 390]) {
    test(
      `catalog Apply preserves a newer ${domain.toLowerCase()} draft ${width}`,
      {
        tag: `@${domain}/Web`,
      },
      async ({ page, isolatedWorker, preferenceFlow }, info) => {
        await preferenceFlow.run(async () => {
          const db = isolatedWorker.database.owner;
          const { campus, semester, category, department } =
            await db.$transaction(async (tx) => {
              const campus = await tx.campus.create({
                data: {
                  jwId: 1,
                  nameCn: "Draft campus",
                  nameEn: "Draft campus",
                },
              });
              const semester = await tx.semester.create({
                data: { jwId: 1, code: "draft-term", nameCn: "2026年秋季学期" },
              });
              const category = await tx.courseCategory.create({
                data: { nameCn: "Draft category", nameEn: "Draft category" },
              });
              const department = await tx.department.create({
                data: {
                  jwId: 1,
                  code: "DRAFT",
                  nameCn: "Draft department",
                  nameEn: "Draft department",
                },
              });
              for (const [index, name] of ["Physics", "Chemistry"].entries()) {
                const course = await tx.course.create({
                  data: {
                    jwId: 1_700_001_000 + index,
                    code: `DRAFT-${index}`,
                    nameCn: name,
                    nameEn: name,
                    categoryId: category.id,
                  },
                });
                await tx.teacher.create({
                  data: {
                    jwId: 1_700_001_000 + index,
                    code: `DRAFT-${index}`,
                    nameCn: name,
                    nameEn: name,
                    departmentId: department.id,
                  },
                });
                await tx.section.create({
                  data: {
                    jwId: 1_700_001_000 + index,
                    code: `DRAFT-${index}.01`,
                    courseId: course.id,
                    semesterId: semester.id,
                    campusId: campus.id,
                    credits: 4,
                  },
                });
              }
              return { campus, semester, category, department };
            });
          await page.setViewportSize({ width, height: 900 });
          await page.context().addCookies([
            {
              name: "NEXT_LOCALE",
              value: "en-us",
              url: isolatedWorker.origin,
            },
          ]);
          const path = `/catalog/${domain.toLowerCase()}s`;
          const initial: Record<string, string> =
            domain === "Section"
              ? {
                  semesterId: String(semester.id),
                  campusId: String(campus.id),
                  sort: "code",
                  order: "asc",
                }
              : domain === "Course"
                ? { categoryId: String(category.id) }
                : { departmentId: String(department.id) };
          await gotoAndWaitForReady(
            page,
            `${path}?${new URLSearchParams(initial)}`,
          );
          const rows = page.locator(
            `#main-content a[href^="${path}/"]:visible`,
          );
          await expect(rows).toHaveCount(2);
          const edited =
            domain === "Section"
              ? { credits: "4", creditsOp: "gte" }
              : { code: "DRAFT-" };
          const column = await openCatalogColumnFilter(
            page,
            domain === "Section" ? /^Credits$/ : /^(Course Code|Code)$/,
          );
          const field = column.locator(
            `[data-filter-field="${domain === "Section" ? "credits" : "code"}"]`,
          );
          if (domain === "Section")
            await field.getByRole("combobox").selectOption("gte");
          await field
            .locator("input")
            .first()
            .fill(domain === "Section" ? "4" : "DRAFT-");

          const release = createDeferred<void>();
          let captured = 0;
          preferenceFlow.onClosing(() => release.resolve());
          await preferenceFlow.route(
            page,
            (url) => url.pathname === `${path}/__data.json`,
            async (route) => {
              const url = new URL(route.request().url());
              if (
                captured ||
                url.searchParams.get(
                  domain === "Section" ? "credits" : "code",
                ) !== (domain === "Section" ? "4" : "DRAFT-")
              ) {
                await route.continue();
                return;
              }
              const response = await route.fetch();
              expect(response.status()).toBe(200);
              captured++;
              await release.promise;
              await route.fulfill({ response });
            },
          );
          try {
            await applyCatalogFilters(page);
            await expect.poll(() => captured).toBe(1);
            const search = page.getByRole("searchbox");
            await search.fill("Physics");
            await expect(search).toHaveValue("Physics");
            expect(
              new URL(page.url()).searchParams.has(
                domain === "Section" ? "credits" : "code",
              ),
            ).toBe(false);
            await expect(rows).toHaveCount(2);
            release.resolve();
            await expect(page).toHaveURL(
              (url) =>
                url.searchParams.get(
                  domain === "Section" ? "credits" : "code",
                ) === (domain === "Section" ? "4" : "DRAFT-"),
            );
            await expect(
              page.locator('[data-slot="active-filters"]'),
            ).toContainText(
              domain === "Section" ? "Credits: At least 4" : "DRAFT-",
            );
            await info.attach(`pending-draft-${domain}-${width}`, {
              body: await page.screenshot({ fullPage: true }),
              contentType: "image/png",
            });
            await expect(search).toHaveValue("Physics");
            const applied = { ...initial, search: "", ...edited };
            expect(
              Object.fromEntries(new URL(page.url()).searchParams),
            ).toEqual(applied);
            await applyCatalogFilters(page);
            await expect(page).toHaveURL(
              (url) => url.searchParams.get("search") === "Physics",
            );
            expect(
              Object.fromEntries(new URL(page.url()).searchParams),
            ).toEqual({
              ...applied,
              search: "Physics",
            });
            await expect(rows).toHaveCount(1);
            await expect(rows.first()).toContainText("Physics");

            await search.fill("Unsaved after success");
            await page.goBack();
            await expect(page).toHaveURL(
              (url) => url.searchParams.get("search") === "",
            );
            await expect(search).toHaveValue("");
            await expect(rows).toHaveCount(2);
            await page.goForward();
            await expect(search).toHaveValue("Physics");
            await expect(rows).toHaveCount(1);
            if (width === 1280) {
              await search.fill("Discard on locale");
              await page
                .getByRole("button", { name: "Language selector", exact: true })
                .click();
              const preference = page.waitForResponse(
                (response) =>
                  new URL(response.url()).pathname ===
                    "/api/account/preferences" &&
                  response.request().method() === "POST",
              );
              await page
                .getByRole("menuitemradio", { name: "中文", exact: true })
                .click();
              expect((await preference).status()).toBe(200);
              await expect(page.locator("html")).toHaveAttribute(
                "lang",
                "zh-cn",
              );
              await expect(search).toHaveValue("Physics");
              expect(
                Object.fromEntries(new URL(page.url()).searchParams),
              ).toEqual({ ...applied, search: "Physics" });
            }
            await search.fill("Discard on clear");
            await page.getByRole("link", { name: /^(Clear|清除)$/ }).click();
            await expect(page).toHaveURL(
              (url) => url.pathname === path && !url.search,
            );
            await expect(search).toHaveValue("");
            await expect(rows).toHaveCount(2);
          } finally {
            release.resolve();
            await preferenceFlow.clearRoutes(page);
          }
        });
      },
    );
  }
}

test("catalog draft follows the latest native Apply when responses finish out of order", {
  tag: "@Course/Web",
}, async ({ page, isolatedWorker, preferenceFlow }) => {
  await preferenceFlow.run(async () => {
    const category = await isolatedWorker.database.owner.courseCategory.create({
      data: { nameCn: "Ordered draft category" },
    });
    await isolatedWorker.database.owner.course.createMany({
      data: ["Physics", "Chemistry", "Physics"].map((name, index) => ({
        jwId: 1_700_002_000 + index,
        code: index === 2 ? "OTHER-PHYSICS" : `ORDERED-DRAFT-${index}`,
        nameCn: name,
        nameEn: name,
        categoryId: category.id,
      })),
    });
    await page
      .context()
      .addCookies([
        { name: "NEXT_LOCALE", value: "en-us", url: isolatedWorker.origin },
      ]);
    const path = "/catalog/courses";
    await gotoAndWaitForReady(
      page,
      `${path}?code=ORDERED-DRAFT&categoryId=${category.id}`,
    );
    const rows = page.locator(
      '#main-content a[href^="/catalog/courses/"]:visible',
    );
    await expect(rows).toHaveCount(2);
    const releases = [createDeferred<void>(), createDeferred<void>()];
    const fulfilled = [createDeferred<void>(), createDeferred<void>()];
    let captured = 0;
    preferenceFlow.onClosing(() => {
      for (const gate of releases) gate.resolve();
    });
    await preferenceFlow.route(
      page,
      (url) => url.pathname === `${path}/__data.json`,
      async (route) => {
        if (captured >= 2) {
          await route.continue();
          return;
        }
        const index = captured++;
        const response = await route.fetch();
        expect(response.status()).toBe(200);
        await releases[index].promise;
        await route.fulfill({ response });
        fulfilled[index].resolve();
      },
    );
    try {
      const search = page.getByRole("searchbox");
      await search.fill("Physics");
      await applyCatalogFilters(page);
      await expect.poll(() => captured).toBe(1);
      await search.fill("Chemistry");
      await applyCatalogFilters(page);
      await expect.poll(() => captured).toBe(2);
      await search.fill("Physics");
      const code = await openCatalogColumnFilter(page, /^Course Code$/);
      await code.locator('[data-filter-field="code"] input').fill("");
      await page.keyboard.press("Escape");
      releases[1].resolve();
      await fulfilled[1].promise;
      await expect(page).toHaveURL(
        (url) => url.searchParams.get("search") === "Chemistry",
      );
      await expect(rows).toHaveCount(1);
      await expect(rows.first()).toContainText("Chemistry");
      await expect(search).toHaveValue("Physics");
      const retained = await openCatalogColumnFilter(page, /^Course Code$/);
      await expect(
        retained.locator('[data-filter-field="code"] input'),
      ).toHaveValue("");
      await page.keyboard.press("Escape");
      releases[0].resolve();
      await fulfilled[0].promise;
      await expect(search).toHaveValue("Physics");
      expect(new URL(page.url()).searchParams.get("search")).toBe("Chemistry");
      await applyCatalogFilters(page);
      await expect(page).toHaveURL(
        (url) => url.searchParams.get("search") === "Physics",
      );
      expect(Object.fromEntries(new URL(page.url()).searchParams)).toEqual({
        categoryId: String(category.id),
        search: "Physics",
      });
      await expect(rows).toHaveCount(2);
      await expect(rows).toHaveText([/Physics/, /Physics/]);
      await page.goBack();
      await expect(page).toHaveURL(
        (url) => url.searchParams.get("search") === "Chemistry",
      );
      await expect(search).toHaveValue("Chemistry");
      await expect(rows).toHaveCount(1);
      await expect(rows.first()).toContainText("Chemistry");
      await page.goForward();
      await expect(search).toHaveValue("Physics");
      await expect(rows).toHaveCount(2);
    } finally {
      for (const gate of releases) gate.resolve();
      await preferenceFlow.clearRoutes(page);
    }
  });
});
