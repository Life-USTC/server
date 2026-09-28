import { expect, type Locator } from "@playwright/test";
import {
  type EmbeddedTablePolicyFixture,
  test,
} from "../../../utils/embedded-table-policy-fixture";
import {
  expectNoPageHorizontalOverflow,
  gotoAndWaitForReady,
} from "../../../utils/page-ready";

function cases(width: number, fixture: EmbeddedTablePolicyFixture) {
  const c = fixture.catalog;
  return [
    ...["homeworks", "exams", "todos"].map((name) => ({
      name,
      path: `/workspace/${name}?semester=${c.semester.code}`,
      heading: "main h1",
      filter: '[data-slot="toggle-group"]',
      summary: "",
      pagination: false,
      records:
        width < 768
          ? `[data-testid="workspace-${name}-cards"] [data-slot="item"]`
          : "main table:visible tbody tr",
    })),
    {
      name: "subscriptions",
      path: "/workspace/subscriptions",
      heading: '[data-testid="subscription-semester-groups"] h3',
      filter: "",
      summary:
        '[data-testid="subscription-semester-groups"] section > div:first-child > span',
      pagination: false,
      records:
        width < 768
          ? '[data-testid="subscription-semester-cards"] [data-slot="item"]'
          : '[data-testid="subscription-semester-table"] tbody tr',
    },
    ...["course", "teacher"].map((name) => ({
      name: `${name}-history`,
      path:
        name === "course"
          ? `/catalog/courses/${c.courses[0].jwId}`
          : `/catalog/teachers/${c.teachers[0].id}`,
      heading: "#sections h2",
      filter: "",
      summary: '#sections [data-slot="results-summary"]',
      pagination: true,
      records:
        width < 768
          ? '#sections [data-slot="item"]:visible'
          : "#sections table:visible tbody tr",
    })),
    {
      name: "organizer-history",
      path: `/catalog/young-events/organizers/${c.organizers[0].id}`,
      heading: "main h2",
      filter: "",
      summary: 'main [data-slot="results-summary"]',
      pagination: true,
      records: 'main [role="list"] > [role="listitem"]',
    },
    {
      name: "section-homework",
      path: `/catalog/sections/${c.sections[0].jwId}`,
      heading: "#homework h2",
      filter: "",
      summary: "",
      pagination: false,
      records:
        width < 768
          ? '#homework [data-slot="item"]:visible'
          : "#homework table:visible tbody tr",
    },
    ...["calendar", "exams"].map((name) => ({
      name: `section-${name}`,
      path: `/catalog/sections/${c.sections[0].jwId}`,
      heading: `#${name} h2`,
      filter: "",
      summary: "",
      pagination: false,
      records: `#${name} table tbody tr`,
    })),
  ];
}

async function precedes(first: Locator, second: Locator, label: string) {
  await expect(first).toBeVisible();
  await expect(second).toBeVisible();
  const handle = await second.elementHandle();
  if (!handle) throw new Error("Missing ordered element");
  expect
    .soft(
      await first.evaluate(
        (node, following) =>
          Boolean(
            node.compareDocumentPosition(following) &
              Node.DOCUMENT_POSITION_FOLLOWING,
          ),
        handle,
      ),
      label,
    )
    .toBe(true);
  const a = await first.boundingBox();
  const b = await second.boundingBox();
  if (!a || !b) throw new Error("Missing ordered bounds");
  const followsOnSameRow = Math.abs(a.y - b.y) <= 1 && a.x + a.width <= b.x + 1;
  expect.soft(followsOnSameRow || a.y + a.height <= b.y + 1, label).toBe(true);
}

test("ui.embedded-collection-order", async ({
  page,
  baseURL,
  isolatedWorker,
  embedded: fixture,
}, testInfo) => {
  test.setTimeout(120_000);
  if (!baseURL) throw new Error("Missing Playwright baseURL");
  await page
    .context()
    .addCookies([
      (await isolatedWorker.createSession(fixture.admin.id)).cookie,
      { name: "NEXT_LOCALE", value: "en-us", url: baseURL },
    ]);
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const item of cases(width, fixture)) {
      await gotoAndWaitForReady(page, item.path);
      const records = page.locator(item.records);
      await expect(records.first()).toBeVisible();
      let previous = page.locator(item.heading).first();
      for (const selector of [item.filter, item.summary].filter(Boolean)) {
        const next = page.locator(selector).first();
        await precedes(previous, next, `${item.name}: heading/filter/summary`);
        previous = next;
      }
      await precedes(
        previous,
        records.first(),
        `${item.name}: records after context`,
      );
      if (item.pagination) {
        await precedes(
          records.last(),
          page.locator('[data-slot="list-pagination"]'),
          `${item.name}: pagination after records`,
        );
      }
      if (["course-history", "teacher-history"].includes(item.name)) {
        await page.locator("#sections").screenshot({
          path: testInfo.outputPath(`embedded-${width}-${item.name}.png`),
        });
      }
    }
  }
});

test("ui.list-table-6", async ({
  page,
  baseURL,
  isolatedWorker,
  busEmbedded: fixture,
}) => {
  test.setTimeout(120_000);
  if (!baseURL) throw new Error("Missing Playwright baseURL");
  await page
    .context()
    .addCookies([
      (await isolatedWorker.createSession(fixture.admin.id)).cookie,
      { name: "NEXT_LOCALE", value: "en-us", url: baseURL },
    ]);
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const item of cases(width, fixture)) {
      await gotoAndWaitForReady(page, item.path);
      await expectNoPageHorizontalOverflow(page);
      const rows = page.locator(item.records);
      await expect(rows.first()).toBeVisible();
      if (["section-calendar", "section-exams"].includes(item.name)) {
        const table = rows.first().locator("xpath=ancestor::table");
        const container = table.locator("xpath=..");
        const count = item.name === "section-calendar" ? 5 : 6;
        await expect(table.locator("thead th")).toHaveCount(count);
        const size = await container.evaluate((node) => ({
          width: node.clientWidth,
          full: node.scrollWidth,
          overflow: getComputedStyle(node).overflowX,
        }));
        expect(size.full).toBeGreaterThan(size.width);
        expect(["auto", "scroll"]).toContain(size.overflow);
        await container.evaluate((node) => {
          node.scrollLeft = node.scrollWidth;
        });
        const last = await table.locator("thead th").last().boundingBox();
        const bounds = await container.boundingBox();
        if (!last || !bounds) throw new Error("Missing scroll bounds");
        expect(last.x + last.width).toBeLessThanOrEqual(
          bounds.x + bounds.width + 1,
        );
        expect(last.x).toBeGreaterThanOrEqual(bounds.x - 1);
        for (const row of await rows.all())
          await expect(row.locator("td")).toHaveCount(count);
      } else {
        for (const row of await rows.all()) {
          await row.scrollIntoViewIfNeeded();
          const bounds = await row.boundingBox();
          if (!bounds) throw new Error("Missing compact record");
          expect.soft(bounds.x, item.name).toBeGreaterThanOrEqual(0);
          expect
            .soft(bounds.x + bounds.width, item.name)
            .toBeLessThanOrEqual(width + 1);
        }
      }
    }
    for (const kind of ["todos", "homeworks"] as const) {
      await gotoAndWaitForReady(
        page,
        `/workspace/${kind}?semester=${fixture.catalog.semester.code}`,
      );
      const title =
        kind === "todos" ? fixture.todo.title : fixture.homework.title;
      await page.getByRole("button", { name: title, exact: true }).click();
      const facts = page.getByRole("dialog").locator("table");
      await expect(facts).toBeVisible();
      const bounds = await facts.boundingBox();
      if (!bounds) throw new Error("Missing task facts");
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      await expectNoPageHorizontalOverflow(page);
      await page.keyboard.press("Escape");
    }
    await gotoAndWaitForReady(page, "/catalog/bus");
    await page
      .getByRole("button", { name: "Change route", exact: true })
      .click();
    // The seeded routes have weekday trips; layout checks must not depend on today.
    const weekday = page.getByRole("radio", { name: "Weekday", exact: true });
    await weekday.click();
    await expect(weekday).toHaveAttribute("aria-checked", "true");
    const departed = page.getByRole("switch", {
      name: "Show departed trips",
      exact: true,
    });
    if ((await departed.getAttribute("aria-checked")) === "false")
      await departed.click();
    await expect(departed).toHaveAttribute("aria-checked", "true");
    await expect(
      page.getByRole("button", { name: "Hide full timetable", exact: true }),
    ).toBeVisible();
    const busGroups = page.getByTestId("bus-route-section");
    await expect(busGroups.first().locator("tr:has(td)").first()).toBeVisible();
    const mobileColumns = await busGroups.evaluateAll((groups) =>
      groups.map((group) =>
        Array.from(group.querySelectorAll('th[scope="col"]')).map((cell) =>
          cell.textContent?.trim(),
        ),
      ),
    );
    for (const group of await busGroups.all()) {
      const columns = group.locator('th[scope="col"]');
      const count = await columns.count();
      expect(count).toBeGreaterThanOrEqual(2);
      const rows = group.locator("tr:has(td)");
      await expect(rows.first()).toBeVisible();
      for (const row of await rows.all())
        await expect(row.locator("td")).toHaveCount(count);
      const table = group.locator("xpath=ancestor::table");
      const container = table.locator("xpath=..");
      await container.evaluate((node) => {
        node.scrollLeft = node.scrollWidth;
      });
      const last = await columns.last().boundingBox();
      const bounds = await container.boundingBox();
      if (!last || !bounds) throw new Error("Missing bus scroll bounds");
      expect(last.x + last.width).toBeLessThanOrEqual(
        bounds.x + bounds.width + 1,
      );
      expect(last.x).toBeGreaterThanOrEqual(bounds.x - 1);
    }
    await expectNoPageHorizontalOverflow(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    expect(
      await busGroups.evaluateAll((groups) =>
        groups.map((group) =>
          Array.from(group.querySelectorAll('th[scope="col"]')).map((cell) =>
            cell.textContent?.trim(),
          ),
        ),
      ),
    ).toEqual(mobileColumns);
  }
});
