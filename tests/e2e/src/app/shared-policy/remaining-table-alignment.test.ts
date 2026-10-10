import { expect, type Locator, test } from "@playwright/test";
import {
  cleanupEmbeddedTablePolicyFixture,
  createEmbeddedTablePolicyFixture,
} from "../../../utils/embedded-table-policy-fixture";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { createSignedSessionCookie } from "../../../utils/workspace-task-filters";

type Alignment = "left" | "right" | "center" | null;

async function checkColumns(
  table: Locator,
  expected: Alignment[],
  name: string,
  headers = "thead th",
  rows = "tbody tr",
) {
  await expect(table).toBeVisible();
  await expect(table.locator(headers)).toHaveCount(expected.length);
  await expect(table.locator(rows).first()).toBeVisible();
  const columns = await table.evaluate(
    (element, selectors) => {
      const normalize = (node: Element) => {
        const align = getComputedStyle(node).textAlign;
        return align === "start" ? "left" : align === "end" ? "right" : align;
      };
      return Array.from(element.querySelectorAll(selectors.headers)).map(
        (header, index) => ({
          label: header.textContent?.trim(),
          header: normalize(header),
          cells: Array.from(element.querySelectorAll(selectors.rows))
            .filter((row) => row.children.length > 1)
            .map((row) => normalize(row.children[index])),
        }),
      );
    },
    { headers, rows },
  );
  for (const [index, column] of columns.entries()) {
    if (expected[index] === null) continue;
    expect
      .soft(column.header, `${name}: ${column.label} header`)
      .toBe(expected[index]);
    expect
      .soft(column.cells.length, `${name}: ${column.label} populated cells`)
      .toBeGreaterThan(0);
    for (const align of column.cells)
      expect.soft(align, `${name}: ${column.label} body`).toBe(expected[index]);
  }
}

async function checkFacts(table: Locator, name: string) {
  await expect(table).toBeVisible();
  const rows = table.locator("tbody tr");
  expect(await rows.count()).toBeGreaterThan(0);
  for (const row of await rows.all()) {
    await expect(row.locator('th[scope="row"]')).toHaveCount(1);
    await expect(row.locator("td")).toHaveCount(1);
    for (const cell of await row.locator("th, td").all()) {
      const alignment = await cell.evaluate(
        (node) => getComputedStyle(node).textAlign,
      );
      expect
        .soft(["left", "start"], `${name}: facts align left`)
        .toContain(alignment);
    }
  }
}

test("ui.data-table-cells-4", async ({ page, baseURL }) => {
  test.setTimeout(120_000);
  if (!baseURL) throw new Error("Missing Playwright baseURL");
  const f = await createEmbeddedTablePolicyFixture();
  try {
    await page
      .context()
      .addCookies([
        await createSignedSessionCookie(f.admin.id),
        { name: "NEXT_LOCALE", value: "en-us", url: baseURL },
      ]);
    await page.setViewportSize({ width: 1280, height: 900 });
    const sectionPath = `/catalog/sections/${f.catalog.sections[0].jwId}`;
    const cases: {
      name: string;
      path: string;
      selector?: string;
      columns: Alignment[];
    }[] = [
      {
        name: "young-events",
        path: `/catalog/young-events?search=${f.catalog.marker}`,
        columns: ["left", "left", "left", null, "left"],
      },
      {
        name: "young-organizers",
        path: `/catalog/young-events/organizers?search=${f.catalog.marker}`,
        columns: ["left", null, null, null],
      },
      {
        name: "uploads",
        path: "/workspace/uploads",
        columns: ["left", null, "left", "left"],
      },
      {
        name: "section-homeworks",
        path: sectionPath,
        selector: '[data-testid="section-homeworks-list"] table:visible',
        columns: ["left", "left", "left"],
      },
      {
        name: "section-exams",
        path: sectionPath,
        selector: '[data-testid="section-exams-list"]',
        columns: ["left", "left", "left", "left", "left", null],
      },
      {
        name: "section-calendar",
        path: sectionPath,
        selector: '[data-testid="section-calendar-table"]',
        columns: ["left", "left", "left", "left", "left"],
      },
      {
        name: "homeworks",
        path: `/workspace/homeworks?semester=${f.catalog.semester.code}`,
        columns: ["left", "left", "left", "left", "left"],
      },
      {
        name: "exams",
        path: `/workspace/exams?semester=${f.catalog.semester.code}`,
        columns: ["left", "left", "left", "left", "left", "left"],
      },
      {
        name: "todos",
        path: "/workspace/todos",
        columns: ["left", "left", "left", "left"],
      },
      {
        name: "subscriptions",
        path: "/workspace/subscriptions",
        columns: ["left", "left", "right", "left"],
      },
      {
        name: "signed-links",
        path: "/catalog/links?linkView=list",
        columns: ["left", "left", "left"],
      },
      {
        name: "sources",
        path: "/news/sources",
        columns: ["left", "right", "left"],
      },
      {
        name: "admin-users",
        path: `/admin/users?search=${f.catalog.marker}`,
        columns: ["left", "left", "left", "center", "center", "right", "right"],
      },
      {
        name: "admin-comments",
        path: `/admin/moderation?tab=comments&search=${f.catalog.marker}`,
        columns: ["left", "left", "left", "right", "center", "right"],
      },
      {
        name: "admin-descriptions",
        path: `/admin/moderation?tab=descriptions&search=${f.catalog.marker}`,
        columns: ["left", "left", "left", "right", "right"],
      },
      {
        name: "admin-homeworks",
        path: "/admin/moderation?tab=homeworks&search=Embedded",
        columns: ["left", "left", "right", "right", "center", "right"],
      },
      {
        name: "admin-suspensions",
        path: "/admin/moderation?tab=suspensions",
        columns: ["left", "left", "right", "center", "right"],
      },
      {
        name: "admin-oauth",
        path: "/admin/oauth",
        columns: ["left", "left", "left", "right", "right"],
      },
      {
        name: "admin-bus",
        path: "/admin/bus",
        columns: ["left", "left", "right", "left", "right", "center", "right"],
      },
    ];
    for (const item of cases) {
      await gotoAndWaitForReady(page, item.path);
      await checkColumns(
        page.locator(item.selector ?? "main table:visible").first(),
        item.columns,
        item.name,
      );
    }
    await gotoAndWaitForReady(page, "/workspace/todos");
    await page.getByRole("button", { name: f.todo.title, exact: true }).click();
    await checkFacts(page.getByRole("dialog").locator("table"), "todo-details");
    await page.keyboard.press("Escape");
    await gotoAndWaitForReady(
      page,
      `/workspace/homeworks?semester=${f.catalog.semester.code}`,
    );
    await page
      .getByRole("button", { name: f.homework.title, exact: true })
      .click();
    await checkFacts(
      page.getByTestId("homework-secondary-details").locator("table"),
      "homework-details",
    );
    await page.keyboard.press("Escape");
    await page.context().clearCookies();
    await page
      .context()
      .addCookies([{ name: "NEXT_LOCALE", value: "en-us", url: baseURL }]);
    await gotoAndWaitForReady(page, "/catalog/links?linkView=list");
    await checkColumns(
      page.locator("main table:visible").first(),
      ["left", "left"],
      "anonymous-links",
    );
    await gotoAndWaitForReady(page, "/catalog/bus");
    // The seeded routes have weekday trips; layout checks must not depend on today.
    const weekday = page.getByRole("radio", { name: "Weekday", exact: true });
    await weekday.click();
    await expect(weekday).toHaveAttribute("aria-checked", "true");
    await page
      .getByRole("switch", { name: "Show departed trips", exact: true })
      .click();
    const groups = page.getByTestId("bus-route-section");
    expect(await groups.count()).toBeGreaterThan(0);
    for (const bus of await groups.all()) {
      const count = await bus.locator('th[scope="col"]').count();
      expect(count).toBeGreaterThanOrEqual(2);
      await checkColumns(
        bus,
        Array.from({ length: count }, (_, index) =>
          index === 0 ? "left" : index === count - 1 ? "right" : "center",
        ),
        "bus-stops",
        'th[scope="col"]',
        "tr:has(td[headers])",
      );
    }
  } finally {
    await cleanupEmbeddedTablePolicyFixture(f);
  }
});
