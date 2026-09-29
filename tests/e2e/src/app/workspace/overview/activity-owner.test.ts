import { expect, type Route } from "@playwright/test";
import { createCalendarContractFixture } from "../../../../utils/calendar-contract";
import { test } from "../../../../utils/calendar-presentation-fixture";

test("overview.activity-owner-transition", async ({
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
      for (const pending of [false, true]) {
        let releaseOld = () => {};
        let held = false;
        const release = new Promise<void>((resolve) => {
          releaseOld = resolve;
        });
        const routeOperations: Promise<void>[] = [];
        const pattern = "**/api/workspace/calendar/events?**";
        const handler = (route: Route) => {
          const operation = (async () => {
            try {
              const response = await route.fetch({
                headers: readHeaders(route.request()),
                maxRedirects: 0,
              });
              const body = await response.json();
              if (
                pending &&
                !held &&
                body.data.some(
                  (item: { youngId: string | null }) =>
                    item.youngId === fixtures[0].young.youngId,
                )
              ) {
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
        await page.route(pattern, handler);
        const errors: unknown[] = [];
        try {
          await page.context().clearCookies();
          await page
            .context()
            .addCookies([
              await calendar.createSignedSessionCookie(fixtures[0].users[0].id),
              { name: "NEXT_LOCALE", value: "en-us", url: calendar.origin },
            ]);
          await page.goto(`/workspace/overview?overviewWeek=${monday}`);
          const focus = page.getByTestId("workspace-overview-focus");
          if (pending) {
            await expect
              .poll(() => held, {
                timeout: 15_000,
                message: "The previous owner's real calendar response is held",
              })
              .toBe(true);
            await expect(focus.getByRole("status")).toContainText("Loading");
            await expect(focus).not.toContainText(
              "Nothing is due or scheduled",
            );
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
                if (
                  document.body.textContent?.includes(marker) &&
                  document.body.textContent.includes(oldTitle)
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
            .getByRole("link", { name: "Today", exact: true })
            .filter({ visible: true })
            .click();
          await expect(page).toHaveURL(`${calendar.origin}/workspace/overview`);
          await expect(
            page
              .getByText(fixtures[1].homework.title, { exact: true })
              .filter({ visible: true })
              .first(),
          ).toBeVisible();
          await expect(page.locator("body")).not.toContainText(
            fixtures[0].young.name,
          );
          releaseOld();
          await expect(focus).toContainText(fixtures[1].young.name);
          await expect(page.locator("body")).not.toContainText(
            fixtures[0].young.name,
          );
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
        }
        if (errors.length === 1) throw errors[0];
        if (errors.length)
          throw new AggregateError(errors, "Overview calendar workflow failed");
      }
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
