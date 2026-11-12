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

for (const locale of ["en-us", "zh-cn"] as const) {
  test(
    `table.multiselect-compact-clear ${locale}`,
    { tag: "@Section/Web" },
    async ({ page, isolatedWorker, preferenceFlow }, testInfo) => {
      await preferenceFlow.run(async () => {
        const db = isolatedWorker.database.owner;
        const campuses = await Promise.all(
          ["East campus", "West campus"].map((name, index) =>
            db.campus.create({ data: { jwId: index + 1, nameCn: name } }),
          ),
        );
        const course = await db.course.create({
          data: {
            jwId: 1600090000,
            code: "ALIGNMENT-FILTER",
            nameCn: "Filter spacing course",
            nameEn: "Filter spacing course",
          },
        });
        await db.section.createMany({
          data: [
            {
              jwId: 1600090001,
              code: "ALIGNMENT-FILTER-EAST",
              courseId: course.id,
              campusId: campuses[0].id,
              credits: 3,
            },
            {
              jwId: 1600090002,
              code: "ALIGNMENT-FILTER-WEST",
              courseId: course.id,
              campusId: campuses[1].id,
              credits: 3,
            },
            {
              jwId: 1600090003,
              code: "ALIGNMENT-FILTER-FOUR",
              courseId: course.id,
              campusId: campuses[1].id,
              credits: 4,
            },
          ],
        });
        const before = await db.section.findMany({ orderBy: { jwId: "asc" } });
        await page.setViewportSize({ width: 1440, height: 900 });
        await page
          .context()
          .addCookies([
            { name: "NEXT_LOCALE", value: locale, url: isolatedWorker.origin },
          ]);
        const query = new URLSearchParams({
          search: "ALIGNMENT-FILTER",
          campusId: String(campuses[0].id),
          credits: "3",
          creditsOp: "eq",
        });
        await gotoAndWaitForReady(page, `/catalog/sections?${query}`);
        const campus = await openCatalogColumnFilter(
          page,
          locale === "en-us" ? "Campus" : "校区",
        );
        const field = campus.locator('[data-filter-field="campusId"]');
        const checkboxes = field.getByRole("checkbox");
        await expect(checkboxes).toHaveCount(2);
        await page.evaluate(() => document.fonts.ready);
        const geometry = await field
          .locator('[data-slot="field"]')
          .evaluateAll((nodes) =>
            nodes.map((node) => {
              const r = node.getBoundingClientRect();
              return { height: r.height, y: r.y };
            }),
          );
        console.info(
          `MULTISELECT_GEOMETRY ${locale} ${JSON.stringify(geometry)}`,
        );
        await page.screenshot({
          path: testInfo.outputPath(`multiselect-${locale}.png`),
          fullPage: true,
        });
        expect(geometry).toHaveLength(2);
        for (const row of geometry) {
          expect(row.height).toBeGreaterThan(0);
          expect(row.height).toBeLessThanOrEqual(32);
        }
        expect(geometry[1].y - geometry[0].y).toBeLessThanOrEqual(36);
        const clear = field.getByRole("button", {
          name: locale === "en-us" ? "Clear" : "清除",
          exact: true,
        });
        await expect(clear).toBeVisible();
        expect(await clear.getAttribute("aria-pressed")).toBeNull();
        const headerOffset = await field
          .locator('[data-slot="field-legend"]')
          .evaluate((legend) => {
            const title = legend.querySelector("span")?.getBoundingClientRect();
            const button = legend
              .querySelector("button")
              ?.getBoundingClientRect();
            if (!title || !button || title.width <= 0 || button.width <= 0)
              throw new Error("Expected visible legend and clear action");
            return Math.abs(
              title.y + title.height / 2 - button.y - button.height / 2,
            );
          });
        expect(headerOffset).toBeLessThanOrEqual(1);
        await page.keyboard.press("Escape");
        const comparison = await openCatalogColumnFilter(
          page,
          locale === "en-us" ? "Credits" : "学分",
        );
        await comparison
          .locator('[data-filter-field="credits"] select')
          .selectOption("lte");
        await page.keyboard.press("Escape");
        await openCatalogColumnFilter(
          page,
          locale === "en-us" ? "Campus" : "校区",
        );
        await checkboxes.nth(1).focus();
        await page.keyboard.press("Space");
        await expect(checkboxes.nth(0)).toHaveAttribute("aria-checked", "true");
        await expect(checkboxes.nth(1)).toHaveAttribute("aria-checked", "true");
        await applyCatalogFilters(page);
        await expect
          .poll(() => new URL(page.url()).searchParams.get("campusId"))
          .toBe(`${campuses[0].id},${campuses[1].id}`);
        const links = page.locator(
          '#main-content a[href^="/catalog/sections/"]:visible',
        );
        await expect(links).toHaveCount(2);
        await expect(
          page.locator(
            '#main-content a[href="/catalog/sections/1600090003"]:visible',
          ),
        ).toHaveCount(0);
        await openCatalogColumnFilter(
          page,
          locale === "en-us" ? "Campus" : "校区",
        );
        const appliedUrl = page.url();
        await clear.focus();
        await page.keyboard.press("Enter");
        await expect(checkboxes.nth(0)).toHaveAttribute(
          "aria-checked",
          "false",
        );
        await expect(checkboxes.nth(1)).toHaveAttribute(
          "aria-checked",
          "false",
        );
        expect(page.url()).toBe(appliedUrl);
        await expect(clear).toBeDisabled();
        await page.keyboard.press("Escape");
        const credits = await openCatalogColumnFilter(
          page,
          locale === "en-us" ? "Credits" : "学分",
        );
        await expect(
          credits.locator('[data-filter-field="credits"] input').first(),
        ).toHaveValue("3");
        await expect(
          credits.locator('[data-filter-field="credits"] select'),
        ).toHaveValue("lte");
        await applyCatalogFilters(page);
        await expect
          .poll(() => new URL(page.url()).searchParams.get("campusId"))
          .toBeNull();
        expect(new URL(page.url()).searchParams.get("credits")).toBe("3");
        expect(new URL(page.url()).searchParams.get("creditsOp")).toBe("lte");
        await expect(links).toHaveCount(2);
        expect(await db.section.findMany({ orderBy: { jwId: "asc" } })).toEqual(
          before,
        );
      });
    },
  );
}
