import { expect } from "@playwright/test";
import {
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../utils/page-ready";
import {
  youngTest as test,
  youngBrowseCase,
} from "../../../utils/public-browse-policy-fixture";

function destination(value: string | null) {
  if (!value) throw new Error("Expected a navigation destination");
  const url = new URL(value, "https://example.test");
  return { path: url.pathname, params: [...url.searchParams.entries()].sort() };
}

test("ui.navigation-landmarks-7", async ({
  page,
  baseURL,
  youngBrowse: fixture,
}) => {
  if (!baseURL) throw new Error("Missing Playwright baseURL");
  await page
    .context()
    .addCookies([{ name: "NEXT_LOCALE", value: "en-us", url: baseURL }]);
  await page.setViewportSize({ width: 1280, height: 900 });
  const browse = youngBrowseCase(fixture);
  const list = new URL(browse.path, baseURL);
  list.searchParams.set("page", "2");
  const cases = [
    { url: list, view: "events", calendarView: null as string | null },
  ];
  for (const basis of ["activity", "registration"]) {
    for (const view of ["day", "week", "month"]) {
      const calendar = new URL(browse.path, baseURL);
      calendar.pathname += "/calendar";
      calendar.searchParams.delete("dateUnknown");
      calendar.searchParams.set("timeBasis", basis);
      calendar.searchParams.set("view", view);
      calendar.searchParams.set(
        "date",
        basis === "activity" ? "2035-09-15" : "2035-09-14",
      );
      cases.push({ url: calendar, view: "calendar", calendarView: view });
    }
  }
  for (const item of cases) {
    await gotoAndWaitForReady(page, item.url.toString());
    const expected = destination(item.url.toString());
    const nav = page.getByTestId("young-browse-nav");
    const active = nav.locator('[aria-current="page"]');
    await expect(active).toHaveCount(1);
    expect(destination(await active.getAttribute("href")).path).toBe(
      item.view === "events"
        ? "/catalog/young-events"
        : "/catalog/young-events/calendar",
    );
    if (item.calendarView) {
      await expect(
        page.getByTestId("young-calendar").locator('nav [aria-current="page"]'),
      ).toHaveText(
        item.calendarView[0].toUpperCase() + item.calendarView.slice(1),
      );
    }
    const event = page.locator('main a[href*="returnTo="]:visible').first();
    const href = await event.getAttribute("href");
    if (!href) throw new Error("Expected an event detail link");
    const detail = new URL(href, baseURL);
    expect(
      destination(detail.searchParams.get("returnTo")),
      item.calendarView ?? "events",
    ).toEqual(expected);
    await event.click();
    await expect(page).toHaveURL(detail.toString());
    await waitForUiSettled(page);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      fixture.marker,
    );
    const back = page.getByRole("link", {
      name:
        item.view === "calendar"
          ? "Back to activity calendar"
          : "Back to all events",
      exact: true,
    });
    expect(destination(await back.getAttribute("href"))).toEqual(expected);
    await back.click();
    await expect.poll(() => destination(page.url())).toEqual(expected);
    await waitForUiSettled(page);
    await expect(
      page.locator('main a[href*="returnTo="]:visible').first(),
    ).toBeVisible();
    await expect(active).toHaveCount(1);
    if (item.calendarView) {
      await expect(
        page.getByTestId("young-calendar").locator('nav [aria-current="page"]'),
      ).toHaveText(
        item.calendarView[0].toUpperCase() + item.calendarView.slice(1),
      );
    } else {
      await expect(
        page.locator('[data-slot="list-pagination"] [aria-current="page"]'),
      ).toHaveText("2");
    }
  }
});
