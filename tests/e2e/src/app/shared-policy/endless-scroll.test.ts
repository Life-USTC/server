import { expect, type Page } from "@playwright/test";
import { createDeferred } from "../../../../shared/deferred";
import type { TestPrismaClient } from "../../../../shared/prisma";
import {
  applyCatalogFilters,
  expectCatalogFilterValue,
  openCatalogColumnFilter,
  setCatalogFilterValue,
} from "../../../utils/catalog-table-filters";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { test } from "../../../utils/personal-preferences-fixture";

async function arrangeCourses(db: TestPrismaClient) {
  await db.course.createMany({
    data: ["A", "B"].flatMap((group, groupIndex) =>
      Array.from({ length: 25 }, (_, index) => ({
        jwId: 1_700_000_000 + groupIndex * 100 + index,
        code: `SCROLL-${group}-${String(index).padStart(2, "0")}`,
        nameCn: `滚动课程 ${group} ${String(index).padStart(2, "0")}`,
        nameEn: `Scroll course ${group} ${String(index).padStart(2, "0")}`,
      })),
    ),
  });
}

function courseLinks(page: Page) {
  return page.locator(
    'main table:visible tbody tr a[href^="/catalog/courses/"]',
  );
}

async function visibleCourses(page: Page) {
  return courseLinks(page).evaluateAll((links) =>
    links.map((link) => link.getAttribute("href")),
  );
}

const expectedCourses = (group: "A" | "B", count: number) =>
  Array.from(
    { length: count },
    (_, index) =>
      `/catalog/courses/${1_700_000_000 + (group === "A" ? 0 : 100) + index}`,
  );

const secondBatch = (url: URL) =>
  url.pathname === "/catalog/courses/__data.json" &&
  url.searchParams.get("page") === "2";

async function observerFrame(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

test("ui.endless-scroll-discards-stale-batches", {
  tag: "@Course/Web",
}, async ({ page, isolatedWorker, preferenceFlow: flow }) => {
  await flow.run(async () => {
    await arrangeCourses(isolatedWorker.database.owner);
    await page
      .context()
      .addCookies([
        { name: "NEXT_LOCALE", value: "en-us", url: isolatedWorker.origin },
      ]);
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoAndWaitForReady(page, "/catalog/courses?search=SCROLL-A");
    await expect
      .poll(() => visibleCourses(page))
      .toEqual(expectedCourses("A", 20));

    const entered = createDeferred();
    const release = createDeferred();
    let attempts = 0;
    flow.onClosing(() => {
      entered.resolve();
      release.resolve();
    });
    await flow.route(
      page,
      (url) =>
        secondBatch(url) && url.searchParams.get("search") === "SCROLL-A",
      async (route) => {
        attempts++;
        const response = await route.fetch({
          headers: { ...route.request().headers(), ...flow.headers },
        });
        expect(response.status()).toBe(200);
        await response.body();
        entered.resolve();
        await release.promise;
        await route.fulfill({ response });
      },
    );
    const continuation = page.locator('[data-slot="endless-scroll"]');
    await continuation.scrollIntoViewIfNeeded();
    await entered.promise;
    await expect(continuation).toHaveAttribute("aria-busy", "true");
    await expect(
      continuation.getByRole("status").filter({ hasText: "Loading…" }),
    ).toBeVisible();
    await page.getByRole("heading", { level: 1 }).scrollIntoViewIfNeeded();
    await continuation.scrollIntoViewIfNeeded();
    await observerFrame(page);
    expect(attempts).toBe(1);

    await page.getByRole("searchbox").fill("SCROLL-B");
    await page
      .getByRole("button", { name: "Apply filters", exact: true })
      .click();
    await expect(page).toHaveURL(
      (url) =>
        url.searchParams.get("search") === "SCROLL-B" &&
        !url.searchParams.has("page"),
    );
    await expect
      .poll(() => visibleCourses(page))
      .toEqual(expectedCourses("B", 20));
    const completed = flow.waitForResponse(
      page,
      (response) =>
        secondBatch(new URL(response.url())) &&
        new URL(response.url()).searchParams.get("search") === "SCROLL-A",
    );
    release.resolve();
    await (await completed).body();
    await observerFrame(page);
    expect(await visibleCourses(page)).toEqual(expectedCourses("B", 20));
    expect(attempts).toBe(1);
    await expect(
      continuation.getByRole("link", { name: "Load more", exact: true }),
    ).toHaveAttribute("href", /search=SCROLL-B(?:&|$)/);
    await continuation.scrollIntoViewIfNeeded();
    await expect
      .poll(() => visibleCourses(page))
      .toEqual(expectedCourses("B", 25));
    await expect(continuation).toHaveCount(0);
  });
});

test("ui.endless-scroll-retries-failed-batches", {
  tag: "@Course/Web",
}, async ({ page, isolatedWorker, preferenceFlow: flow }) => {
  await flow.run(async () => {
    await arrangeCourses(isolatedWorker.database.owner);
    await page
      .context()
      .addCookies([
        { name: "NEXT_LOCALE", value: "en-us", url: isolatedWorker.origin },
      ]);
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoAndWaitForReady(page, "/catalog/courses?search=SCROLL-A");
    const originalUrl = page.url();
    await expect
      .poll(() => visibleCourses(page))
      .toEqual(expectedCourses("A", 20));
    let attempts = 0;
    await flow.route(page, secondBatch, async (route) => {
      attempts++;
      if (attempts === 1) {
        // Browser-side outage injection; no real Worker read is claimed for it.
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "Unavailable fixture batch" }),
        });
      } else {
        await route.continue();
      }
    });
    const continuation = page.locator('[data-slot="endless-scroll"]');
    await continuation.scrollIntoViewIfNeeded();
    const retry = continuation.getByRole("link", {
      name: "Retry",
      exact: true,
    });
    await expect(retry).toBeVisible();
    await expect(continuation.getByRole("status")).toBeVisible();
    await expect(continuation).toHaveAttribute("aria-busy", "false");
    expect(await visibleCourses(page)).toEqual(expectedCourses("A", 20));
    await expect(page).toHaveURL(originalUrl);
    await page.getByRole("heading", { level: 1 }).scrollIntoViewIfNeeded();
    await continuation.scrollIntoViewIfNeeded();
    await observerFrame(page);
    expect(attempts).toBe(1);
    await retry.click();
    await expect
      .poll(() => visibleCourses(page))
      .toEqual(expectedCourses("A", 25));
    expect(attempts).toBe(2);
    await expect(page).toHaveURL(originalUrl);
    await expect(continuation).toHaveCount(0);
  });
});

test("ui.endless-scroll-preserves-filter-drafts", {
  tag: "@Course/Web",
}, async ({ page, isolatedWorker, preferenceFlow: flow }) => {
  await flow.run(async () => {
    await arrangeCourses(isolatedWorker.database.owner);
    await page
      .context()
      .addCookies([
        { name: "NEXT_LOCALE", value: "en-us", url: isolatedWorker.origin },
      ]);
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoAndWaitForReady(page, "/catalog/courses?search=SCROLL-A");
    const originalUrl = page.url();
    await expect
      .poll(() => visibleCourses(page))
      .toEqual(expectedCourses("A", 20));
    const entered = createDeferred();
    const release = createDeferred();
    flow.onClosing(() => {
      entered.resolve();
      release.resolve();
    });
    await flow.route(page, secondBatch, async (route) => {
      const response = await route.fetch({
        headers: { ...route.request().headers(), ...flow.headers },
      });
      expect(response.status()).toBe(200);
      await response.body();
      entered.resolve();
      await release.promise;
      await route.fulfill({ response });
    });
    await page.locator('[data-slot="endless-scroll"]').scrollIntoViewIfNeeded();
    await entered.promise;
    const code = await openCatalogColumnFilter(
      page,
      /^(课程代码|Course Code)$/i,
    );
    await setCatalogFilterValue(code, "code", "SCROLL-A-24");
    await page.keyboard.press("Escape");
    const completed = flow.waitForResponse(page, (response) =>
      secondBatch(new URL(response.url())),
    );
    release.resolve();
    await (await completed).body();
    await expect
      .poll(() => visibleCourses(page))
      .toEqual(expectedCourses("A", 25));
    await expect(page).toHaveURL(originalUrl);
    await openCatalogColumnFilter(page, /^(课程代码|Course Code)$/i);
    await expectCatalogFilterValue(code, "code", "SCROLL-A-24");
    await applyCatalogFilters(page);
    await expect(page).toHaveURL(
      (url) =>
        url.searchParams.get("search") === "SCROLL-A" &&
        url.searchParams.get("code") === "SCROLL-A-24" &&
        !url.searchParams.has("page"),
    );
    await expect
      .poll(() => visibleCourses(page))
      .toEqual(["/catalog/courses/1700000024"]);
  });
});
