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

test("ui.list-pagination-filter-state", async ({
  page,
  baseURL,
  isolatedWorker,
  collection: fixture,
}) => {
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
    await gotoAndWaitForReady(page, item.path);
    const key = item.name.endsWith("history") ? "sectionsPage" : "page";
    const original = queryState(page.url(), baseURL, key);
    expect(original, item.name).toEqual(queryState(item.path, baseURL, key));
    const rows = page.locator(item.rows);
    await expect(rows).toHaveCount(20);
    const first = await identities(rows, item.text);
    const pagination = page.locator('[data-slot="list-pagination"]');
    await expect(pagination).toHaveCount(1);
    for (const link of await pagination.getByRole("link").all()) {
      const href = await link.getAttribute("href");
      if (!href) throw new Error("Expected URL pagination");
      expect(queryState(href, page.url(), key), item.name).toEqual(original);
    }
    await pagination.locator('[data-value="2"]').press("Enter");
    await expect(page).toHaveURL((url) => url.searchParams.get(key) === "2");
    await waitForUiSettled(page);
    expect(queryState(page.url(), baseURL, key), item.name).toEqual(original);
    await expect(pagination.locator('[aria-current="page"]')).toHaveText("2");
    await expect(rows).toHaveCount(5);
    const second = await identities(rows, item.text);
    expect(
      second.every((value) => !first.includes(value)),
      item.name,
    ).toBe(true);
    await page.goBack();
    await expect(pagination.locator('[aria-current="page"]')).toHaveText("1");
    expect(queryState(page.url(), baseURL, key), item.name).toEqual(original);
    await expect
      .poll(() => identities(rows, item.text), { message: item.name })
      .toEqual(first);
    await page.goForward();
    await expect(pagination.locator('[aria-current="page"]')).toHaveText("2");
    expect(queryState(page.url(), baseURL, key), item.name).toEqual(original);
    await expect
      .poll(() => identities(rows, item.text), { message: item.name })
      .toEqual(second);
  }
});
