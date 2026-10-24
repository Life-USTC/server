import { expect } from "@playwright/test";
import {
  applyCatalogFilters,
  openCatalogColumnFilter,
  setCatalogFilterValue,
} from "../../../utils/catalog-table-filters";
import { test } from "../../../utils/owned-worker";
import { gotoAndWaitForReady } from "../../../utils/page-ready";

test("section filter drafts, multi-selection, comparisons and reactive pagination", {
  tag: "@Section/Web",
}, async ({ page, isolatedWorker, run }) => {
  await run(async () => {
    const db = isolatedWorker.database.owner;
    const campuses = await db.$transaction(async (tx) => {
      const campuses = await Promise.all(
        ["East", "West"].map((name, index) =>
          tx.campus.create({ data: { jwId: index + 1, nameCn: name } }),
        ),
      );
      const semester = await tx.semester.create({
        data: { jwId: 1, code: "2026-fall", nameCn: "2026年秋季学期" },
      });
      const course = await tx.course.create({
        data: {
          jwId: 1_600_000_000,
          code: "FILTER-PAGING",
          nameCn: "Pagination course",
        },
      });
      await tx.section.createMany({
        data: campuses.flatMap((campus, campusIndex) =>
          Array.from({ length: 30 }, (_, index) => ({
            jwId: 1_600_000_000 + campusIndex * 30 + index,
            code: `FILTER-PAGING-${campusIndex}-${String(index).padStart(2, "0")}`,
            courseId: course.id,
            semesterId: semester.id,
            campusId: campus.id,
            credits: index < 25 ? 3 : 4,
            stdCount: index,
            limitCount: 40,
          })),
        ),
      });
      return campuses;
    });
    const query = {
      search: "FILTER-PAGING",
      campusId: String(campuses[0].id),
      credits: "3",
      creditsOp: "gte",
      sort: "code",
      order: "asc",
    };
    await gotoAndWaitForReady(
      page,
      `/catalog/sections?${new URLSearchParams(query)}`,
    );
    const pagination = page.locator('[data-slot="list-pagination"]');
    const next = pagination.getByRole("link", { name: /下一页|Next page/i });
    await expect(
      pagination.locator('[data-slot="pagination-link"]'),
    ).toHaveCount(2);
    await expect(next).toHaveAttribute(
      "href",
      new RegExp(`campusId=${campuses[0].id}(?:&|$)`),
    );
    await expect(
      page.getByRole("button", { name: /^(应用筛选|Apply filters)$/i }),
    ).toHaveCount(1);

    const campus = await openCatalogColumnFilter(page, /^(校区|Campus)$/i);
    await setCatalogFilterValue(campus, "campusId", String(campuses[1].id));
    await expect(
      campus.getByRole("button", { name: /应用筛选|Apply filters/i }),
    ).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(campus).toBeHidden();
    expect(new URL(page.url()).searchParams.get("campusId")).toBe(
      String(campuses[0].id),
    );
    await expect(
      page.locator(
        '#main-content a[href="/catalog/sections/1600000000"]:visible',
      ),
    ).toHaveCount(1);
    await applyCatalogFilters(page);
    const applied = { ...query, campusId: String(campuses[1].id) };
    await expect
      .poll(() => Object.fromEntries(new URL(page.url()).searchParams))
      .toEqual(applied);
    // Both filters have 30 rows: page and totalPages remain 1 and 2. The mounted
    // pagination must still rebuild links from the newly applied URL.
    await expect(
      pagination.locator('[data-slot="pagination-link"]'),
    ).toHaveCount(2);
    await expect(next).toHaveAttribute(
      "href",
      new RegExp(`campusId=${campuses[1].id}(?:&|$)`),
    );
    for (const link of await pagination.getByRole("link").all()) {
      const href = await link.getAttribute("href");
      if (!href) throw new Error("Pagination link is missing its destination");
      const target = new URL(href, page.url());
      for (const [key, value] of Object.entries(applied))
        expect(target.searchParams.get(key)).toBe(value);
    }
    await next.click();
    await expect
      .poll(() => Object.fromEntries(new URL(page.url()).searchParams))
      .toEqual({ ...applied, page: "2" });
    await expect(
      page.locator('#main-content a[href^="/catalog/sections/"]:visible'),
    ).toHaveCount(10);
    await page.reload();
    await expect(pagination.locator('[aria-current="page"]')).toHaveText("2");
    expect(Object.fromEntries(new URL(page.url()).searchParams)).toEqual({
      ...applied,
      page: "2",
    });

    const both = campuses.map((item) => item.id).join(",");
    await setCatalogFilterValue(
      await openCatalogColumnFilter(page, /^(校区|Campus)$/i),
      "campusId",
      both,
    );
    await page.keyboard.press("Escape");
    const credit = await openCatalogColumnFilter(page, /^(学分|Credits)$/i);
    const creditField = credit.locator('[data-filter-field="credits"]');
    await creditField.getByRole("combobox").selectOption("between");
    await creditField.locator("input").nth(0).fill("3");
    await creditField.locator("input").nth(1).fill("3");
    await page
      .getByRole("button", { name: /^(应用筛选|Apply filters)$/i })
      .click();
    await expect(credit).toBeHidden();
    await expect
      .poll(() => Object.fromEntries(new URL(page.url()).searchParams))
      .toEqual({
        ...applied,
        campusId: [campuses[1].id, campuses[0].id].join(","),
        creditsOp: "between",
        creditsMax: "3",
      });
    await expect(
      pagination.locator('[data-slot="pagination-link"]'),
    ).toHaveCount(3);
    await pagination
      .getByRole("link", { name: /分页 3|Pagination 3/i })
      .click();
    await expect(
      page.locator('#main-content a[href^="/catalog/sections/"]:visible'),
    ).toHaveCount(10);
    await expect(
      page.locator(
        '#main-content a[href="/catalog/sections/1600000054"]:visible',
      ),
    ).toHaveCount(1);
    await expect(
      page.locator(
        '#main-content a[href="/catalog/sections/1600000055"]:visible',
      ),
    ).toHaveCount(0);
  });
});
