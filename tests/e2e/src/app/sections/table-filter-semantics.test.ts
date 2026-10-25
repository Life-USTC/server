import { expect } from "@playwright/test";
import {
  applyCatalogFilters,
  openCatalogColumnFilter,
  setCatalogFilterValue,
} from "../../../utils/catalog-table-filters";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { test } from "../../../utils/personal-preferences-fixture";

test("section filter drafts, multi-selection, comparisons and reactive pagination", {
  tag: "@Section/Web",
}, async ({ page, isolatedWorker, preferenceFlow }) => {
  await preferenceFlow.run(async () => {
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
    const continuation = page.locator('[data-slot="endless-scroll"]');
    const next = continuation.getByRole("link", {
      name: /加载更多|Load more/i,
    });
    const rows = page.locator(
      '#main-content a[href^="/catalog/sections/"]:visible',
    );
    await expect(rows).toHaveCount(20);
    await expect(continuation).toHaveCount(1);
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
    // Both filters have 30 rows. The next batch must use the newly applied
    // parameters even though the page and total page count have not changed.
    await expect(rows).toHaveCount(20);
    await expect(continuation).toHaveCount(1);
    await expect(next).toHaveAttribute(
      "href",
      new RegExp(`campusId=${campuses[1].id}(?:&|$)`),
    );
    const href = await next.getAttribute("href");
    if (!href) throw new Error("Next batch is missing its destination");
    const target = new URL(href, page.url());
    for (const [key, value] of Object.entries(applied))
      expect(target.searchParams.get(key)).toBe(value);
    expect(target.searchParams.get("page")).toBe("2");
    await continuation.scrollIntoViewIfNeeded();
    await expect
      .poll(() => Object.fromEntries(new URL(page.url()).searchParams))
      .toEqual(applied);
    await expect(rows).toHaveCount(30);
    expect(
      await rows.evaluateAll((links) =>
        links.map((link) => link.getAttribute("href")),
      ),
    ).toEqual(
      Array.from(
        { length: 30 },
        (_, index) => `/catalog/sections/${1_600_000_030 + index}`,
      ),
    );
    await expect(continuation).toHaveCount(0);

    // A bookmarked batch retains the same server-side filter contract.
    await gotoAndWaitForReady(page, target.toString());
    await expect(rows).toHaveCount(10);
    await page.reload();
    await expect(rows).toHaveCount(10);
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
    await expect(rows).toHaveCount(20);
    await continuation.scrollIntoViewIfNeeded();
    await expect(rows).toHaveCount(40);
    await continuation.scrollIntoViewIfNeeded();
    await expect(rows).toHaveCount(50);
    expect(
      await rows.evaluateAll((links) =>
        links.map((link) => link.getAttribute("href")),
      ),
    ).toEqual(
      [0, 30].flatMap((offset) =>
        Array.from(
          { length: 25 },
          (_, index) => `/catalog/sections/${1_600_000_000 + offset + index}`,
        ),
      ),
    );
    await expect(continuation).toHaveCount(0);
    expect(new URL(page.url()).searchParams.has("page")).toBe(false);
  });
});
