import { expect, type Locator } from "@playwright/test";
import { test } from "../../../utils/other-collection-policy-fixture";
import {
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../utils/page-ready";

function queryState(value: string, base: string, pageKey: string) {
  const url = new URL(value, base);
  url.searchParams.delete(pageKey);
  return { path: url.pathname, params: [...url.searchParams.entries()].sort() };
}
async function identities(rows: Locator, text: boolean) {
  return rows.evaluateAll(
    (elements, text) =>
      elements.map((element) => {
        const value = text
          ? element.querySelector("td")?.textContent?.trim()
          : element.querySelector("a")?.getAttribute("href");
        if (!value) throw new Error("Expected a record identity");
        return value;
      }),
    text,
  );
}

for (const [domain, names] of [
  ["Upload", ["uploads"]],
  ["Admin", ["users"]],
  ["Young", ["events", "organizers", "notifications", "organizer-events"]],
  ["Course", ["course-history"]],
  ["Teacher", ["teacher-history"]],
] as const) {
  test(`ui.list-pagination-filter-state ${domain}`, {
    tag: `@${domain}/Web`,
  }, async ({
    browseRun,
    page,
    baseURL,
    isolatedWorker,
    collection: fixture,
  }) => {
    await browseRun(async () => {
      if (!baseURL) throw new Error("Missing Playwright baseURL");
      await page
        .context()
        .addCookies([
          (await isolatedWorker.createSession(fixture.admin.id)).cookie,
          { name: "NEXT_LOCALE", value: "en-us", url: baseURL },
        ]);
      await page.setViewportSize({ width: 1280, height: 900 });
      const catalog = fixture.catalog;
      const cases = [
        {
          name: "uploads",
          path: "/workspace/uploads",
          rows: "main table:visible tbody tr",
          text: false,
        },
        {
          name: "users",
          path: `/admin/users?search=${catalog.marker}-member`,
          rows: "main table:visible tbody tr",
          text: true,
        },
        ...["events", "organizers", "notifications"].map((view) => ({
          name: view,
          path: `/workspace/subscriptions/activities?view=${view}${view === "notifications" ? "&unread=true" : ""}`,
          rows: 'main [data-slot="item-group"] > [data-slot="item"]',
          text: false,
        })),
        {
          name: "organizer-events",
          path: `/catalog/young-events/organizers/${catalog.organizers[0].id}`,
          rows: 'main [role="list"] > [role="listitem"]',
          text: false,
        },
        {
          name: "course-history",
          path: `/catalog/courses/${catalog.courses[0].jwId}`,
          rows: "main table:visible tbody tr",
          text: false,
        },
        {
          name: "teacher-history",
          path: `/catalog/teachers/${catalog.teachers[0].id}`,
          rows: "main table:visible tbody tr",
          text: false,
        },
      ];
      for (const item of cases) {
        if (!names.some((name) => name === item.name)) continue;
        await gotoAndWaitForReady(page, item.path);
        const key = item.name.endsWith("history") ? "sectionsPage" : "page";
        const original = queryState(page.url(), baseURL, key);
        expect(original, item.name).toEqual(
          queryState(item.path, baseURL, key),
        );
        const rows = page.locator(item.rows);
        await expect(rows).toHaveCount(20);
        const first = await identities(rows, item.text);
        const originalUrl = page.url();
        const continuation = page.locator('[data-slot="endless-scroll"]');
        const more = continuation.getByRole("link", {
          name: "Load more",
          exact: true,
        });
        await expect(continuation).toHaveCount(1);
        await expect(page.locator('[data-slot="list-pagination"]')).toHaveCount(
          0,
        );
        const href = await more.getAttribute("href");
        if (!href) throw new Error("Expected the next batch destination");
        expect(queryState(href, page.url(), key), item.name).toEqual(original);
        expect(new URL(href, page.url()).searchParams.get(key)).toBe("2");
        // Keyboard activation must work independently of the scroll observer.
        await more.evaluate((element) =>
          (element as HTMLElement).focus({ preventScroll: true }),
        );
        await page.keyboard.press("Enter");
        await expect(rows).toHaveCount(25);
        await expect(page).toHaveURL(originalUrl);
        const accumulated = await identities(rows, item.text);
        expect(accumulated.slice(0, 20), item.name).toEqual(first);
        expect(new Set(accumulated).size, item.name).toBe(25);
        await expect(continuation).toHaveCount(0);

        await page
          .locator('a[href="/"]')
          .filter({ visible: true })
          .first()
          .click();
        await expect(page).toHaveURL(new URL("/", baseURL).toString());
        await waitForUiSettled(page);
        await page.goBack();
        await expect(page).toHaveURL(originalUrl);
        await waitForUiSettled(page);
        await expect(rows).toHaveCount(25);
        await expect
          .poll(() => identities(rows, item.text), { message: item.name })
          .toEqual(accumulated);
        await expect(continuation).toHaveCount(0);
      }
    });
  });
}
