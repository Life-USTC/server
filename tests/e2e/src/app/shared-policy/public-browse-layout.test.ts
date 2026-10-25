import { expect, type Page } from "@playwright/test";
import { COLLECTION_DESKTOP_MIN_WIDTH_PX } from "@/lib/components/collection-responsive-breakpoint";
import {
  expectNoPageHorizontalOverflow,
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../utils/page-ready";
import {
  publicBrowseCases,
  test,
} from "../../../utils/public-browse-policy-fixture";
import { expectCollectionOrder } from "./_collection-layout";

const filterCounts: Record<string, { columns: number; toolbar: number }> = {
  courses: { columns: 5, toolbar: 0 },
  teachers: { columns: 4, toolbar: 2 },
  // Six extra-property filters and the existing advanced-search help.
  sections: { columns: 7, toolbar: 7 },
  events: { columns: 5, toolbar: 7 },
  organizers: { columns: 4, toolbar: 0 },
};

function records(page: Page, name: string, width = 1280) {
  if (name === "news")
    return page
      .getByRole("list", { name: "Campus News & Notices" })
      .getByRole("listitem");
  if (width < COLLECTION_DESKTOP_MIN_WIDTH_PX)
    return page.locator('main [role="list"]:visible > [role="listitem"]');
  return page.locator("main table:visible tbody tr");
}
async function prepare(page: Page, baseURL: string | undefined, width: number) {
  if (!baseURL) throw new Error("Missing Playwright baseURL");
  await page
    .context()
    .addCookies([{ name: "NEXT_LOCALE", value: "en-us", url: baseURL }]);
  await page.setViewportSize({ width, height: 900 });
}

function withoutPage(value: string) {
  const url = new URL(value, "https://example.test");
  url.searchParams.delete("page");
  return {
    path: url.pathname,
    params: [...url.searchParams.entries()].sort(
      ([a, av], [b, bv]) => a.localeCompare(b) || av.localeCompare(bv),
    ),
  };
}

async function rowLinks(page: Page, name: string, width: number) {
  return records(page, name, width).evaluateAll((rows) =>
    rows.map((row) => {
      const href = row.querySelector("a")?.getAttribute("href");
      if (!href) throw new Error("Expected a primary record link");
      return href;
    }),
  );
}

for (const [domain, names] of [
  ["Course", ["courses"]],
  ["Teacher", ["teachers"]],
  ["Section", ["sections"]],
  ["Young", ["events", "organizers"]],
  ["Publication", ["news"]],
] as const) {
  test(`ui.list-table-1 ${domain}`, { tag: `@${domain}/Web` }, async ({
    browseRun,
    page,
    baseURL,
    browse: fixture,
  }) => {
    await browseRun(async () => {
      for (const width of [390, 1280]) {
        await prepare(page, baseURL, width);
        for (const item of publicBrowseCases(fixture)) {
          if (!names.some((name) => name === item.name)) continue;
          await gotoAndWaitForReady(page, item.path);
          const frame = page.locator('[data-slot="page-layout"]');
          await expect(frame).toHaveCount(1);
          await expect(
            frame.locator(":scope > header").getByRole("heading", { level: 1 }),
          ).toHaveCount(1);
          const panel = frame.locator(
            ':scope > [data-slot="page-layout-content"] > [data-slot="page-section"]',
          );
          await expect(panel).toHaveCount(1);
          const search = panel.getByRole("searchbox");
          await expect(search).toBeVisible();
          if (item.name !== "news") {
            const toolbar = panel.locator('[data-slot="table-filter-toolbar"]');
            await expect(toolbar).toHaveCount(1);
            await expect(toolbar.getByRole("searchbox")).toBeVisible();
            const apply = page.getByRole("button", {
              name: "Apply filters",
              exact: true,
            });
            await expect(apply).toHaveCount(1);
            await expect(
              toolbar.getByRole("button", {
                name: "Apply filters",
                exact: true,
              }),
            ).toBeVisible();
            expect(
              await toolbar.evaluate((node) =>
                Boolean(node.closest('thead, [data-slot="collection-header"]')),
              ),
              `${item.name}: whole-page controls precede the column header`,
            ).toBe(false);
            const header = panel.locator(
              width < COLLECTION_DESKTOP_MIN_WIDTH_PX
                ? '[data-slot="collection-header"]:visible'
                : "table:visible thead",
            );
            await expect(header).toHaveCount(1);
            await expect(
              header.locator('[data-slot="table-column-header"]'),
            ).toHaveCount(filterCounts[item.name].columns);
            await expect(
              toolbar.locator('[data-slot="table-column-header"]'),
            ).toHaveCount(filterCounts[item.name].toolbar);
            await expectCollectionOrder(
              frame.getByRole("heading", { level: 1 }),
              toolbar,
              `${item.name}: heading before whole-page controls`,
            );
            await expectCollectionOrder(
              toolbar,
              header,
              `${item.name}: whole-page controls before column controls`,
            );
            await expectCollectionOrder(
              header,
              records(page, item.name, width).first(),
              `${item.name}: column controls before records`,
            );
          }
          await expect(
            panel.locator('[data-slot="results-summary"]'),
          ).toHaveCount(0);
          const rows = records(page, item.name, width);
          await expect(rows).toHaveCount(20);
          const continuation = panel.locator('[data-slot="endless-scroll"]');
          await expect(continuation).toHaveCount(1);
          await expect(
            page.locator('[data-slot="list-pagination"]'),
          ).toHaveCount(0);
          const ordered = await panel.evaluate((element) => {
            const filter = Array.from(
              element.querySelectorAll('input[type="search"]'),
            ).find((node) => node.getClientRects().length > 0);
            const footer = element.querySelector(
              '[data-slot="page-section-footer"]',
            );
            if (!filter || !footer) return false;
            return Boolean(
              filter.compareDocumentPosition(footer) &
                Node.DOCUMENT_POSITION_FOLLOWING,
            );
          });
          expect(ordered, item.name).toBe(true);
          expect(
            await rows.last().evaluate((node) => {
              const content = node.closest('[data-slot="page-section-body"]');
              const footer = content?.parentElement?.querySelector(
                '[data-slot="page-section-footer"]',
              );
              return Boolean(
                footer &&
                  node.compareDocumentPosition(footer) &
                    Node.DOCUMENT_POSITION_FOLLOWING,
              );
            }),
          ).toBe(true);
          expect(
            await continuation.evaluate((node) =>
              Boolean(node.closest('[data-slot="page-section-footer"]')),
            ),
          ).toBe(true);
        }
      }
    });
  });
}

for (const [domain, names] of [
  ["Course", ["courses"]],
  ["Teacher", ["teachers"]],
  ["Section", ["sections"]],
  ["Young", ["events", "organizers"]],
  ["Publication", ["news"]],
] as const) {
  test(`ui.public-browse-responsive-lists ${domain}`, {
    tag: `@${domain}/Web`,
  }, async ({ browseRun, page, baseURL, browse: fixture }) => {
    await browseRun(async () => {
      for (const width of [320, 390]) {
        await prepare(page, baseURL, width);
        // Each viewport starts a new browse entry; reloading the same URL at
        // its old bottom would immediately request the next batch.
        await gotoAndWaitForReady(page, "/");
        for (const item of publicBrowseCases(fixture)) {
          if (!names.some((name) => name === item.name)) continue;
          await gotoAndWaitForReady(page, item.path);
          const rows = records(page, item.name, width);
          await expect(rows).toHaveCount(20);
          await expectNoPageHorizontalOverflow(page);
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            item.name,
          ).toBe(true);
          await page
            .locator('[data-slot="endless-scroll"]')
            .scrollIntoViewIfNeeded();
          await expect(rows).toHaveCount(item.total);
          for (const row of await rows.all()) {
            await row.scrollIntoViewIfNeeded();
            const box = await row.boundingBox();
            if (!box) throw new Error("Expected a rendered compact row");
            expect(box.x, item.name).toBeGreaterThanOrEqual(0);
            expect(box.x + box.width, item.name).toBeLessThanOrEqual(width);
          }
          await expect(
            page.locator('[data-slot="endless-scroll"]'),
          ).toHaveCount(0);
          expect(withoutPage(page.url()), item.name).toEqual(
            withoutPage(item.path),
          );
          expect(new URL(page.url()).searchParams.has("page")).toBe(false);
        }
      }
    });
  });
}

for (const [domain, names] of [
  ["Course", ["courses"]],
  ["Teacher", ["teachers"]],
  ["Section", ["sections"]],
  ["Young", ["events", "organizers"]],
  ["Publication", ["news"]],
] as const) {
  test(`ui.public-browse-pagination-state ${domain}`, {
    tag: `@${domain}/Web`,
  }, async ({ browseRun, page, baseURL, browse: fixture }) => {
    await browseRun(async () => {
      for (const width of [1280, 390]) {
        await prepare(page, baseURL, width);
        await gotoAndWaitForReady(page, "/");
        for (const item of publicBrowseCases(fixture)) {
          if (!names.some((name) => name === item.name)) continue;
          await gotoAndWaitForReady(page, item.path);
          await expect(records(page, item.name, width)).toHaveCount(20);
          const original = withoutPage(page.url());
          expect(original).toEqual(withoutPage(item.path));
          const first = await rowLinks(page, item.name, width);
          const originalUrl = page.url();
          const continuation = page.locator('[data-slot="endless-scroll"]');
          const more = continuation.getByRole("link", {
            name: "Load more",
            exact: true,
          });
          const href = await more.getAttribute("href");
          if (!href) throw new Error("Expected the next batch destination");
          expect(withoutPage(href), item.name).toEqual(original);
          expect(new URL(href, page.url()).searchParams.get("page")).toBe("2");
          await continuation.scrollIntoViewIfNeeded();
          await expect(records(page, item.name, width)).toHaveCount(item.total);
          await expect(page).toHaveURL(originalUrl);
          const accumulated = await rowLinks(page, item.name, width);
          expect(accumulated.slice(0, 20), item.name).toEqual(first);
          expect(new Set(accumulated).size, item.name).toBe(item.total);
          await expect(continuation).toHaveCount(0);

          const last = records(page, item.name, width)
            .last()
            .locator("a")
            .first();
          const detailHref = await last.getAttribute("href");
          if (!detailHref)
            throw new Error("Expected an appended record destination");
          await last.click();
          await expect(page).toHaveURL(
            new URL(detailHref, originalUrl).toString(),
          );
          await page.goBack();
          await expect(page).toHaveURL(originalUrl);
          await waitForUiSettled(page);
          await expect
            .poll(() => rowLinks(page, item.name, width))
            .toEqual(accumulated);
          await expect(continuation).toHaveCount(0);
          await expect(records(page, item.name, width).last()).toBeInViewport();
        }
      }
    });
  });
}
