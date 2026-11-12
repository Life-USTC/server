import { expect, type Request, type Route } from "@playwright/test";
import { personalCalendarPageSchema } from "../../../../../../src/lib/api/schemas/young-workspace-schemas";
import { createCalendarContractFixture } from "../../../../utils/calendar-contract";
import { test } from "../../../../utils/calendar-presentation-fixture";

test("overview.activity-owner-transition", { tag: "@Overview/Web" }, async ({
  page,
  calendar,
  calendarDb,
  calendarRun,
}) => {
  test.setTimeout(120_000);
  const fixtures = [calendar, await createCalendarContractFixture(calendarDb)];
  const now = new Date();
  const shifted = new Date(now.getTime() + 8 * 3600000);
  const monday = new Date(
    shifted.getTime() - ((shifted.getUTCDay() + 6) % 7) * 86400000,
  )
    .toISOString()
    .slice(0, 10);
  await calendarDb(async (db) => {
    for (const fixture of fixtures) {
      await db.youngEvent.update({
        where: { youngId: fixture.young.youngId },
        data: {
          startAt: new Date(now.getTime() - 1800000),
          endAt: new Date(now.getTime() + 1800000),
        },
      });
      await db.todo.update({
        where: { id: fixture.todo.id },
        data: { completed: true },
      });
    }
  });
  await calendarRun(
    async ({ readHeaders }) => {
      for (const pending of [null, "activity", "overview"] as const) {
        let releaseOld = () => {};
        let held = false;
        const release = new Promise<void>((resolve) => {
          releaseOld = resolve;
        });
        page.once("close", releaseOld);
        const routeOperations: Promise<void>[] = [];
        let previousOwnerRequest: Request | undefined;
        let previousOwnerTerminal: "finished" | "failed" | undefined;
        const finished = (request: Request) => {
          if (request === previousOwnerRequest)
            previousOwnerTerminal = "finished";
        };
        const failed = (request: Request) => {
          if (request === previousOwnerRequest)
            previousOwnerTerminal = "failed";
        };
        page.on("requestfinished", finished);
        page.on("requestfailed", failed);
        const pattern =
          pending === "overview"
            ? "**/_internal/home/viewer*"
            : "**/api/workspace/calendar/events?**";
        const handler = (route: Route) => {
          const operation = (async () => {
            try {
              const response = await route.fetch({
                headers: readHeaders(route.request()),
                maxRedirects: 0,
              });
              const body = await response.json();
              const previousOwner =
                pending === "overview"
                  ? body.navStats?.user.id === fixtures[0].users[0].id
                  : body.data.some(
                      (item: { youngId: string | null }) =>
                        item.youngId === fixtures[0].young.youngId,
                    );
              if (!previousOwnerRequest && previousOwner)
                previousOwnerRequest = route.request();
              if (pending && !held && previousOwner) {
                held = true;
                await release;
              }
              await route.fulfill({ response }).catch((error) => {
                if (!route.request().failure()) throw error;
              });
            } catch (error) {
              try {
                await route.abort("failed");
              } catch (abortError) {
                throw new AggregateError(
                  [error, abortError],
                  "Overview calendar response failed",
                );
              }
              throw error;
            }
          })();
          routeOperations.push(operation);
          void operation.catch(() => undefined);
          return operation;
        };
        const errors: unknown[] = [];
        let routesDrained = false;
        const drainRoutes = async () => {
          if (routesDrained) return;
          routesDrained = true;
          try {
            await page.unroute(pattern, handler);
          } catch (error) {
            errors.push(error);
          }
          const settled = await Promise.allSettled(routeOperations);
          errors.push(
            ...settled.flatMap((result) =>
              result.status === "rejected" ? [result.reason] : [],
            ),
          );
        };
        try {
          await page.route(pattern, handler);
          await page.context().clearCookies();
          await page
            .context()
            .addCookies([
              await calendar.createSignedSessionCookie(fixtures[0].users[0].id),
              { name: "NEXT_LOCALE", value: "en-us", url: calendar.origin },
            ]);
          await page.goto(`/?overviewWeek=${monday}`);
          const focus = page.getByTestId("workspace-overview-focus");
          if (pending) {
            await expect
              .poll(() => held, {
                timeout: 15_000,
                message: "The previous owner's real calendar response is held",
              })
              .toBe(true);
            if (pending === "overview") {
              await expect(
                page.getByTestId("home-personal-loading"),
              ).toBeVisible();
              await expect(focus).toHaveCount(0);
            } else {
              await expect(focus.getByRole("status")).toContainText("Loading");
              await expect(focus).not.toContainText(
                "Nothing is due or scheduled",
              );
            }
          } else {
            await expect(focus).toContainText(fixtures[0].young.name);
          }
          await page.evaluate(
            ({ marker, oldTitle }) => {
              const state = window as typeof window & {
                overviewOwnerLeak?: boolean;
                overviewOldDocument?: boolean;
              };
              state.overviewOldDocument = true;
              state.overviewOwnerLeak = false;
              const observer = new MutationObserver(() => {
                const personalText = document.querySelector(
                  '[data-testid="home-personal-overview"]',
                )?.textContent;
                if (
                  personalText?.includes(marker) &&
                  personalText.includes(oldTitle)
                )
                  state.overviewOwnerLeak = true;
              });
              observer.observe(document.body, {
                childList: true,
                subtree: true,
                characterData: true,
              });
            },
            {
              marker: fixtures[1].homework.title,
              oldTitle: fixtures[0].young.name,
            },
          );
          await page.context().clearCookies();
          await page
            .context()
            .addCookies([
              await calendar.createSignedSessionCookie(fixtures[1].users[0].id),
              { name: "NEXT_LOCALE", value: "en-us", url: calendar.origin },
            ]);
          await page
            .getByTestId("app-sidebar")
            .getByRole("link", {
              name: /^Life@USTC: (Home|首页)$/,
              exact: true,
            })
            .filter({ visible: true })
            .click();
          await expect(page).toHaveURL(`${calendar.origin}/`);
          await expect(
            page
              .getByText(fixtures[1].homework.title, { exact: true })
              .filter({ visible: true })
              .first(),
          ).toBeVisible();
          await expect(
            page.getByTestId("home-personal-overview"),
          ).not.toContainText(fixtures[0].young.name);
          releaseOld();
          await drainRoutes();
          expect(previousOwnerRequest).toBeDefined();
          await expect.poll(() => previousOwnerTerminal).toBeDefined();
          if (previousOwnerTerminal === "failed")
            expect(previousOwnerRequest?.failure()?.errorText).toBe(
              "net::ERR_ABORTED",
            );
          // Native completion precedes a rendering opportunity for the
          // current promise, Svelte and MutationObserver work.
          await page.evaluate(
            () =>
              new Promise<void>((resolve) => {
                requestAnimationFrame(() =>
                  requestAnimationFrame(() => resolve()),
                );
              }),
          );
          await expect(
            page
              .getByText(fixtures[1].homework.title, { exact: true })
              .filter({ visible: true })
              .first(),
          ).toBeVisible();
          await expect(focus).toContainText(fixtures[1].young.name);
          await expect(
            page.getByTestId("home-personal-overview"),
          ).not.toContainText(fixtures[0].young.name);
          expect(
            await page.evaluate(
              () =>
                (window as typeof window & { overviewOldDocument?: boolean })
                  .overviewOldDocument,
            ),
          ).toBe(true);
          expect(
            await page.evaluate(
              () =>
                (window as typeof window & { overviewOwnerLeak?: boolean })
                  .overviewOwnerLeak,
            ),
          ).toBe(false);
        } catch (error) {
          errors.push(error);
        } finally {
          releaseOld();
          await drainRoutes();
          page.off("close", releaseOld);
          page.off("requestfinished", finished);
          page.off("requestfailed", failed);
        }
        if (errors.length === 1) throw errors[0];
        if (errors.length)
          throw new AggregateError(errors, "Overview calendar workflow failed");
      }
      await page.context().clearCookies();
      await page
        .getByRole("link", { name: /^Life@USTC: (Home|首页)$/, exact: true })
        .filter({ visible: true })
        .first()
        .click();
      await expect(page.getByTestId("home-personal-overview")).toHaveCount(0);
    },
    { accountIndex: 0, calendarTokenCreated: false },
  );
  // The first actor is checked by calendarRun after all tagged reads settle.
  // The second actor also keeps its credential and audit state unchanged.
  await calendarDb(async (db) => {
    const userId = fixtures[1].users[0].id;
    expect(
      await db.user.findUniqueOrThrow({
        where: { id: userId },
        select: { calendarFeedToken: true },
      }),
    ).toEqual({ calendarFeedToken: null });
    expect(await db.auditLog.findMany({ where: { userId } })).toEqual([]);
  });
});

for (const [locale, width] of [
  ["en-us", 1280],
  ["zh-cn", 390],
] as const) {
  test(`overview.activity-loading-retains-focus ${locale} ${width}`, {
    tag: "@Overview/Web",
  }, async ({ page, calendar, calendarDb, calendarRun }) => {
    const snapshotAt = "2026-11-12T04:00:00.000Z";
    const now = Date.parse(snapshotAt);
    const focusTitle = "Overview loading homework";
    const activityTitle = "Held overview activity";
    await calendarDb(async (db) => {
      await db.user.update({
        where: { id: calendar.users[0].id },
        data: { name: "Overview reader" },
      });
      await db.homework.update({
        where: { id: calendar.homework.id },
        data: { title: focusTitle, submissionDueAt: new Date(now + 3600000) },
      });
      await db.todo.update({
        where: { id: calendar.todo.id },
        data: { completed: true },
      });
      await db.youngEvent.update({
        where: { youngId: calendar.young.youngId },
        data: {
          name: activityTitle,
          startAt: new Date(now + 7200000),
          endAt: new Date(now + 10800000),
        },
      });
    });
    await calendarRun(
      async ({ readHeaders }) => {
        let release = () => {};
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        let held = false;
        let capturedRequest: Request | undefined;
        let terminal: "finished" | "failed" | undefined;
        const operations: Promise<void>[] = [];
        const errors: unknown[] = [];
        const pattern = "**/api/workspace/calendar/events?**";
        const finished = (request: Request) => {
          if (request === capturedRequest) terminal = "finished";
        };
        const failed = (request: Request) => {
          if (request === capturedRequest) terminal = "failed";
        };
        const handler = (route: Route) => {
          const operation = (async () => {
            const response = await route.fetch({
              headers: readHeaders(route.request()),
              maxRedirects: 0,
            });
            expect(response.status()).toBe(200);
            const body = personalCalendarPageSchema.parse(
              await response.json(),
            );
            expect(body.data).toEqual(
              expect.arrayContaining([
                expect.objectContaining({
                  youngId: calendar.young.youngId,
                  title: activityTitle,
                }),
              ]),
            );
            if (!capturedRequest) {
              capturedRequest = route.request();
              held = true;
              await gate;
            }
            await route.fulfill({ response });
          })();
          operations.push(operation);
          void operation.catch(() => undefined);
          return operation;
        };
        page.on("requestfinished", finished);
        page.on("requestfailed", failed);
        page.once("close", release);
        try {
          await page.route(pattern, handler);
          await page.setViewportSize({ width, height: 844 });
          await page.context().clearCookies();
          await page
            .context()
            .addCookies([
              await calendar.createSignedSessionCookie(calendar.users[0].id),
              { name: "NEXT_LOCALE", value: locale, url: calendar.origin },
            ]);
          await page.goto(`/?snapshotAt=${encodeURIComponent(snapshotAt)}`);
          await expect.poll(() => held).toBe(true);
          const focus = page.getByTestId("workspace-overview-focus");
          const title = focus.getByTestId("overview-focus-title");
          await expect(title).toHaveText(focusTitle);
          const sections = page.locator("[data-overview-sections]");
          if (width >= 1000) {
            const sidebar = page.getByTestId("app-sidebar");
            const rail = sidebar.getByRole("button", {
              name: locale === "en-us" ? "Toggle sidebar" : "切换侧边栏",
              exact: true,
            });
            await expect(rail).toHaveCount(1);
            await rail.click();
            await expect(sidebar).toHaveCSS("width", "48px");
          }
          await expect(focus.getByRole("status")).toContainText(
            locale === "en-us" ? "Loading" : "加载",
          );
          await expect(sections).toHaveAttribute("aria-busy", "true");
          await expect(title).toHaveText(focusTitle);
          await page.screenshot({
            path: `/tmp/life1573-after-${locale}-${width}.png`,
            fullPage: width < 1000,
          });
          release();
          await Promise.all(operations);
          await expect.poll(() => terminal).toBe("finished");
          await expect(
            page.getByTestId("workspace-overview-upcoming"),
          ).toContainText(activityTitle);
          await expect(title).toHaveText(focusTitle);
          await expect(sections).toHaveAttribute("aria-busy", "false");
          await expect(focus.getByRole("status")).toHaveCount(0);
        } finally {
          release();
          await page
            .unroute(pattern, handler)
            .catch((error) => errors.push(error));
          const results = await Promise.allSettled(operations);
          errors.push(
            ...results.flatMap((result) =>
              result.status === "rejected" ? [result.reason] : [],
            ),
          );
          page.off("requestfinished", finished);
          page.off("requestfailed", failed);
          page.off("close", release);
        }
        if (errors.length)
          throw new AggregateError(
            errors,
            "Held overview activity read failed",
          );
      },
      { accountIndex: 0, calendarTokenCreated: false },
    );
  });
}
