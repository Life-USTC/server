import { expect, type Page } from "@playwright/test";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import {
  publicBrowseCases,
  test,
} from "../../../utils/public-browse-policy-fixture";

function records(page: Page, name: string, width = 1280) {
  if (name === "news")
    return page
      .getByRole("list", { name: "Campus News & Notices" })
      .getByRole("listitem");
  if (width < 1280)
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

async function rowLinks(page: Page, name: string) {
  return records(page, name).evaluateAll((rows) =>
    rows.map((row) => {
      const href = row.querySelector("a")?.getAttribute("href");
      if (!href) throw new Error("Expected a primary record link");
      return href;
    }),
  );
}

test("ui.list-table-1", async ({ page, baseURL, browse: fixture }) => {
  for (const width of [390, 1280]) {
    await prepare(page, baseURL, width);
    for (const item of publicBrowseCases(fixture)) {
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
      const filters = panel.locator('[data-slot="page-section-header"]');
      await expect(filters.getByRole("searchbox").first()).toBeVisible();
      const summary = panel.locator('[data-slot="results-summary"]');
      const rows = records(page, item.name, width);
      await expect(rows).toHaveCount(20);
      const pagination = panel.locator('[data-slot="list-pagination"]');
      await expect(pagination).toHaveCount(1);
      const ordered = await panel.evaluate((element) => {
        const filter = element.querySelector(
          '[data-slot="page-section-header"]',
        );
        const summary = element.querySelector('[data-slot="results-summary"]');
        const footer = element.querySelector(
          '[data-slot="page-section-footer"]',
        );
        if (!filter || !summary || !footer) return false;
        return (
          Boolean(
            filter.compareDocumentPosition(summary) &
              Node.DOCUMENT_POSITION_FOLLOWING,
          ) &&
          Boolean(
            summary.compareDocumentPosition(footer) &
              Node.DOCUMENT_POSITION_FOLLOWING,
          )
        );
      });
      expect(ordered, item.name).toBe(true);
      expect(
        await summary.evaluate((node) =>
          Boolean(node.closest('[data-slot="page-section-body"]')),
        ),
      ).toBe(true);
      expect(
        await rows.first().evaluate((node) => {
          const content = node.closest('[data-slot="page-section-body"]');
          const summary = content?.querySelector(
            '[data-slot="results-summary"]',
          );
          const footer = content?.parentElement?.querySelector(
            '[data-slot="page-section-footer"]',
          );
          return Boolean(
            summary &&
              footer &&
              summary.compareDocumentPosition(node) &
                Node.DOCUMENT_POSITION_FOLLOWING &&
              node.compareDocumentPosition(footer) &
                Node.DOCUMENT_POSITION_FOLLOWING,
          );
        }),
      ).toBe(true);
      expect(
        await pagination.evaluate((node) =>
          Boolean(node.closest('[data-slot="page-section-footer"]')),
        ),
      ).toBe(true);
    }
  }
});

test("ui.public-browse-responsive-lists", async ({
  page,
  baseURL,
  browse: fixture,
}) => {
  for (const width of [320, 390]) {
    await prepare(page, baseURL, width);
    for (const item of publicBrowseCases(fixture)) {
      await gotoAndWaitForReady(page, item.path);
      const rows = records(page, item.name, width);
      await expect(rows).toHaveCount(20);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        item.name,
      ).toBe(true);
      for (const row of await rows.all()) {
        await row.scrollIntoViewIfNeeded();
        const box = await row.boundingBox();
        if (!box) throw new Error("Expected a rendered compact row");
        expect(box.x, item.name).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, item.name).toBeLessThanOrEqual(width);
      }
      await expect(
        page.locator('[data-slot="list-pagination"] [aria-current="page"]'),
      ).toHaveText("1");
    }
  }
});

test("ui.public-browse-pagination-state", async ({
  page,
  baseURL,
  browse: fixture,
}) => {
  await prepare(page, baseURL, 1280);
  for (const item of publicBrowseCases(fixture)) {
    await gotoAndWaitForReady(page, item.path);
    await expect(records(page, item.name)).toHaveCount(20);
    const original = withoutPage(page.url());
    expect(original).toEqual(withoutPage(item.path));
    const first = await rowLinks(page, item.name);
    const pagination = page.locator('[data-slot="list-pagination"]');
    for (const link of await pagination.getByRole("link").all()) {
      const href = await link.getAttribute("href");
      if (!href) throw new Error("Expected URL pagination");
      expect(withoutPage(href), item.name).toEqual(original);
    }
    await pagination.locator('[data-value="2"]').focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL((url) => url.searchParams.get("page") === "2");
    await expect(
      page.locator('[data-slot="list-pagination"] [aria-current="page"]'),
    ).toHaveText("2");
    expect(withoutPage(page.url()), item.name).toEqual(original);
    await expect(records(page, item.name)).toHaveCount(item.total - 20);
    const second = await rowLinks(page, item.name);
    expect(
      second.every((href) => !first.includes(href)),
      item.name,
    ).toBe(true);
    await page.goBack();
    await expect(
      page.locator('[data-slot="list-pagination"] [aria-current="page"]'),
    ).toHaveText("1");
    expect(withoutPage(page.url()), item.name).toEqual(original);
    expect(await rowLinks(page, item.name), item.name).toEqual(first);
    await page.goForward();
    await expect(
      page.locator('[data-slot="list-pagination"] [aria-current="page"]'),
    ).toHaveText("2");
    expect(withoutPage(page.url()), item.name).toEqual(original);
    expect(await rowLinks(page, item.name), item.name).toEqual(second);
  }
});
