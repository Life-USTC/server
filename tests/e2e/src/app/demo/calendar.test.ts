import { expect, type Route } from "@playwright/test";
import { createDeferred } from "../../../../shared/deferred";
import { createSignedDemoCookie } from "../../../../shared/demo-token";
import { withBrowserWorkflow } from "../../../utils/browser-workflow";
import { expectNavigationCount } from "../../../utils/navigation-count";
import { test as workerTest } from "../../../utils/owned-worker";
import {
  expectNoPageHorizontalOverflow,
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../utils/page-ready";
import { expectRenderedUiQuality } from "../../../utils/ui-quality";

const test = workerTest.extend<{
  browserRun: (work: () => Promise<void>) => Promise<void>;
}>({
  browserRun: async ({ page, run }, use) => {
    await withBrowserWorkflow(page, async (workflow) => {
      await use((work) => workflow.run(() => run(() => workflow.body(work))));
    });
  },
});
test.use({ workerBindings: { DEMO_ENABLED: "1", E2E_DEBUG_AUTH: "0" } });

test("demo.calendar: exit and history cannot restore a held previous demo calendar response", {
  tag: "@Account/Web",
}, async ({ page, isolatedWorker, browserRun }) => {
  await browserRun(async () => {
    await page.context().addCookies([
      {
        ...(await createSignedDemoCookie({
          issuedAt: Math.floor(Date.now() / 1000) - 60,
        })),
        url: isolatedWorker.origin,
      },
      { name: "NEXT_LOCALE", value: "en-us", url: isolatedWorker.origin },
    ]);
    const release = createDeferred();
    const operations: Promise<void>[] = [];
    const errors: unknown[] = [];
    let captured = 0;
    let hold = true;
    const pattern = /\/api\/workspace\/calendar\/events\?/;
    const handler = (route: Route) => {
      const operation = (async () => {
        if (!hold) {
          await route.continue();
          return;
        }
        const response = await route.fetch();
        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(body.pagination.total).toBe(9);
        expect(
          body.data.some((item: { type: string }) => item.type === "schedule"),
        ).toBe(true);
        captured++;
        await release.promise;
        await route.fulfill({ response });
      })();
      operations.push(
        operation.catch((error: unknown) => {
          errors.push(error);
        }),
      );
      return operation;
    };
    const close = () => release.resolve();
    page.on("close", close);
    await page.route(pattern, handler);
    try {
      await gotoAndWaitForReady(page, "/workspace/calendar");
      await expect.poll(() => captured).toBe(1);
      await expect(page.getByTestId("demo-notice")).toBeVisible();
      const before = await (
        await page.request.get("/_internal/shell-bootstrap")
      ).json();
      const [exit] = await Promise.all([
        page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === "/account/demo/exit" &&
            response.request().method() === "POST",
        ),
        page.getByRole("button", { name: "Exit demo", exact: true }).click(),
      ]);
      expect(exit.status()).toBe(303);
      await expect(page).toHaveURL(/\/account\/sign-in$/);
      await expect(page.getByTestId("demo-notice")).toHaveCount(0);
      // Keep the real old Worker response held across the identity transition.
      hold = false;
      await page.goBack({ waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(
        (url) =>
          url.pathname === "/account/sign-in" &&
          url.searchParams.get("callbackUrl") === "/workspace/calendar",
      );
      await expect(page.getByTestId("demo-notice")).toHaveCount(0);
      await page
        .getByRole("button", { name: "Enter demo", exact: true })
        .click();
      await expect(page).toHaveURL(/\/workspace\/todos$/);
      await gotoAndWaitForReady(page, "/workspace/calendar");
      const after = await (
        await page.request.get("/_internal/shell-bootstrap")
      ).json();
      expect(after.viewer).toBeNull();
      expect(after.demo.expiresAt).toBeGreaterThan(before.demo.expiresAt);
      release.resolve();
      await Promise.all(operations);
      expect(errors).toEqual([]);
      await expect(page).toHaveURL(/\/workspace\/calendar$/);
      await expect(page.getByTestId("demo-notice")).toBeVisible();
      await expect(
        page.locator('a[href="/catalog/sections/910001"]:visible').first(),
      ).toBeVisible();
      await expect(page.locator("#app-user-menu")).toHaveCount(0);
      expect(captured).toBe(1);
    } finally {
      release.resolve();
      await Promise.all(operations);
      if (!page.isClosed()) await page.unroute(pattern, handler);
      page.off("close", close);
    }
  });
});

for (const locale of ["zh-cn", "en-us"] as const) {
  for (const width of [1280, 390]) {
    test(
      `demo.calendar: existing read-only calendar ${locale} ${width}`,
      { tag: "@Account/Web" },
      async ({ page, request, isolatedWorker, browserRun }, testInfo) => {
        await browserRun(async () => {
          const english = locale === "en-us";
          const probeId = crypto.randomUUID();
          const probe = `/__test/community-effects?id=${probeId}`;
          const secret = {
            "x-test-storage-secret": "local-test-storage-observer",
          };
          const registered = await request.post(`${probe}&io=1`, {
            headers: secret,
          });
          expect(registered.status()).toBe(201);
          await registered.body();
          try {
            await page.setViewportSize({ width, height: 844 });
            await page.setExtraHTTPHeaders({
              ...secret,
              "x-test-community-probe": probeId,
            });
            await page.context().addCookies([
              {
                ...(await createSignedDemoCookie({
                  issuedAt: Math.floor(Date.now() / 1000),
                })),
                url: isolatedWorker.origin,
              },
              {
                name: "NEXT_LOCALE",
                value: locale,
                url: isolatedWorker.origin,
              },
            ]);
            await gotoAndWaitForReady(page, "/workspace/todos");
            if (width === 1280) {
              const navigation = page.locator(
                '[data-shell-navigation="desktop"]',
              );
              const link = navigation.locator(
                'a[data-slot="sidebar-menu-button"][href="/workspace/calendar"]',
              );
              await expect(link).toBeVisible();
              await expectNavigationCount(
                navigation,
                "/workspace/calendar",
                9,
                english ? "items" : "汇总项",
              );
              await page.screenshot({
                path: testInfo.outputPath(
                  `after-navigation-${locale}-${width}.png`,
                ),
                fullPage: true,
              });
              await link.click();
              await waitForUiSettled(page);
            } else await gotoAndWaitForReady(page, "/workspace/calendar");
            await expect(page.getByTestId("demo-notice")).toContainText(
              english ? "Read only" : "只读",
            );
            await expect(
              page.getByRole("radio", {
                name: english ? "Day" : "日",
                exact: true,
              }),
            ).toBeVisible();
            for (const name of english
              ? ["Day", "Week", "Month", "Semester"]
              : ["日", "周", "月", "学期"]) {
              await page.getByRole("radio", { name, exact: true }).click();
              await waitForUiSettled(page);
              await expect(
                page.getByRole("radio", { name, exact: true }),
              ).toBeChecked();
              if (name === (english ? "Day" : "日")) {
                await expect(
                  page.getByRole("textbox", {
                    name: english ? "Date" : "日期",
                    exact: true,
                  }),
                ).toHaveValue("2026-09-24");
                const course = page
                  .getByTestId("calendar-agenda")
                  .locator('a[href="/catalog/sections/910001"]')
                  .filter({ visible: true })
                  .first();
                await expect(course).toContainText(
                  english ? "Linear Algebra" : "线性代数",
                );
                await expect(course).toContainText("08:00");
                await expect(course).toContainText("09:45");
                await course.scrollIntoViewIfNeeded();
                await expect(course).toBeInViewport({ ratio: 1 });
                await page.screenshot({
                  path: testInfo.outputPath(
                    `after-calendar-day-${locale}-${width}.png`,
                  ),
                  fullPage: false,
                });
              }
            }
            await expect(
              page
                .locator('a[href="/catalog/sections/910001"]:visible')
                .first(),
            ).toBeVisible();
            await expect(
              page
                .locator('a[href="/catalog/sections/910002"]:visible')
                .first(),
            ).toBeVisible();
            await expect(
              page.locator('a[href="/catalog/sections/910003"]:visible'),
            ).toHaveCount(0);
            await expectRenderedUiQuality(page);
            await expectNoPageHorizontalOverflow(page);
            await page.screenshot({
              path: testInfo.outputPath(
                `after-calendar-full-${locale}-${width}.png`,
              ),
              fullPage: true,
            });
            await page.screenshot({
              path: testInfo.outputPath(
                `after-calendar-${locale}-${width}.png`,
              ),
              fullPage: false,
            });
            await page
              .getByRole("button", {
                name: english ? "Previous semester" : "上一学期",
                exact: true,
              })
              .click();
            await waitForUiSettled(page);
            await expect(page).toHaveURL(/calendarSemester=2602/);
            await expect(
              page
                .locator('a[href="/catalog/sections/910003"]:visible')
                .first(),
            ).toBeVisible();
            await expect(
              page.locator('a[href="/catalog/sections/910001"]:visible'),
            ).toHaveCount(0);
            await page
              .getByRole("button", {
                name: english ? "Today" : "今天",
                exact: true,
              })
              .click();
            await waitForUiSettled(page);
            await expect(
              page
                .locator('a[href="/catalog/sections/910001"]:visible')
                .first(),
            ).toBeVisible();
            await expect(page.locator('a[href$=".ics"]:visible')).toHaveCount(
              0,
            );
            await expect(
              page.locator(
                'a[href="/workspace/subscriptions/activities"]:visible',
              ),
            ).toHaveCount(0);
            if (width === 390) {
              await page
                .getByRole("button", {
                  name: english ? "More calendar actions" : "更多日历操作",
                  exact: true,
                })
                .click();
              await expect(page.getByRole("menuitem")).toHaveCount(1);
              await expect(page.getByRole("menuitem")).toBeDisabled();
              await page.keyboard.press("Escape");
            }
            const api = await page.request.get(
              "/api/workspace/calendar/events?dateFrom=2026-09-01&dateTo=2027-01-24&pageSize=2&page=5",
            );
            expect(api.status()).toBe(200);
            expect(await api.json()).toMatchObject({
              data: [{ type: "exam" }],
              pagination: { total: 9, totalPages: 5 },
            });
            expect(api.headers()["cache-control"]).toBe("private, no-store");
            const bootstrap = await page.request.get(
              "/_internal/shell-bootstrap",
            );
            expect(await bootstrap.json()).toMatchObject({
              viewer: null,
              navigation: { calendarItemsCount: 9 },
            });
            const effectsResponse = await request.get(probe, {
              headers: secret,
            });
            const effects = await effectsResponse.json();
            expect(effects).toMatchObject({
              purges: [],
              messages: [],
              backgroundErrors: [],
              io: { bindings: [], outbound: [] },
            });
            expect(effects.requests.length).toBeGreaterThan(10);
            expect(
              effects.requests.every(
                (entry: { outcome: string }) => entry.outcome === "fulfilled",
              ),
            ).toBe(true);
          } finally {
            const removed = await request.delete(probe, { headers: secret });
            expect(removed.status()).toBe(204);
            await removed.body();
          }
        });
      },
    );
  }
}
