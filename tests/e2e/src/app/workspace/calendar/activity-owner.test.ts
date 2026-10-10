import { expect, type Route } from "@playwright/test";
import { createCalendarContractFixture } from "../../../../utils/calendar-contract";
import { test } from "../../../../utils/calendar-presentation-fixture";

test("calendar.activity-owner-transition", { tag: "@Calendar/Web" }, async ({
  page,
  calendar,
  calendarDb,
  calendarRun,
  run,
}) => {
  test.setTimeout(120_000);
  await run(async () => {
    const fixtures = [calendar];
    const now = new Date();
    const shifted = new Date(now.getTime() + 8 * 3600000);
    const today = shifted.toISOString().slice(0, 10);
    const monday = new Date(
      shifted.getTime() - ((shifted.getUTCDay() + 6) % 7) * 86400000,
    )
      .toISOString()
      .slice(0, 10);
    await calendarDb((client) =>
      client.$transaction(async (db) => {
        const { cleanup: _cleanup, ...second } =
          await createCalendarContractFixture((work) =>
            work({ $transaction: async (body) => body(db) }),
          );
        fixtures.push({
          ...second,
          origin: calendar.origin,
          createSignedSessionCookie: calendar.createSignedSessionCookie,
        });
        const semester = await db.semester.create({
          data: {
            jwId: fixtures[0].section.jwId + 60,
            nameCn: "日历用户切换学期",
            code: `OWNER-${fixtures[0].course.code}`,
            startDate: new Date(`${monday}T00:00:00Z`),
            endDate: new Date(now.getTime() + 28 * 86400000),
          },
        });
        for (const fixture of fixtures) {
          await db.section.update({
            where: { id: fixture.section.id },
            data: { semesterId: semester.id },
          });
          await db.schedule.updateMany({
            where: { sectionId: fixture.section.id },
            data: { date: new Date(`${today}T00:00:00Z`) },
          });
          await db.youngEvent.update({
            where: { youngId: fixture.young.youngId },
            data: {
              startAt: new Date(now.getTime() - 1800000),
              endAt: new Date(now.getTime() + 1800000),
            },
          });
        }
      }),
    );
    await calendarRun(
      async ({ readHeaders }) => {
        for (const ownerIndex of [0, 1]) {
          for (const pending of [false, true]) {
            let held = false;
            let releaseOld = () => {};
            const release = new Promise<void>((resolve) => {
              releaseOld = resolve;
            });
            page.once("close", releaseOld);
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
                      "Calendar owner response failed",
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
            try {
              await page.route(pattern, handler);
              await page.context().clearCookies();
              await page
                .context()
                .addCookies([
                  await calendar.createSignedSessionCookie(
                    fixtures[0].users[ownerIndex].id,
                  ),
                  { name: "NEXT_LOCALE", value: "en-us", url: calendar.origin },
                ]);
              await page.goto(`/workspace/calendar?calendarWeek=${monday}`);
              if (pending)
                await expect
                  .poll(() => held, {
                    timeout: 15_000,
                    message:
                      "The previous owner's real calendar response is held",
                  })
                  .toBe(true);
              else
                await expect(page.locator("body")).toContainText(
                  fixtures[0].young.name,
                );
              await page.evaluate(
                ({ marker, oldTitle, oldCourse }) => {
                  const state = window as typeof window & {
                    calendarOwnerLeak?: boolean;
                    calendarOldDocument?: boolean;
                  };
                  state.calendarOldDocument = true;
                  state.calendarOwnerLeak = false;
                  new MutationObserver(() => {
                    // SSR bootstrap scripts retain initial data but are never rendered.
                    const renderedText = document.body.innerText;
                    if (
                      renderedText.includes(marker) &&
                      (renderedText.includes(oldTitle) ||
                        renderedText.includes(oldCourse))
                    )
                      state.calendarOwnerLeak = true;
                  }).observe(document.body, {
                    childList: true,
                    subtree: true,
                    characterData: true,
                  });
                },
                {
                  marker: fixtures[1].users[ownerIndex].name,
                  oldTitle: fixtures[0].young.name,
                  oldCourse: fixtures[0].course.nameEn as string,
                },
              );
              await page.context().clearCookies();
              await page
                .context()
                .addCookies([
                  await calendar.createSignedSessionCookie(
                    fixtures[1].users[ownerIndex].id,
                  ),
                  { name: "NEXT_LOCALE", value: "en-us", url: calendar.origin },
                ]);
              await page
                .getByTestId("app-sidebar")
                .getByRole("link", { name: "Calendar", exact: true })
                .filter({ visible: true })
                .click();
              await expect(page).toHaveURL(
                `${calendar.origin}/workspace/calendar`,
              );
              await expect(page.locator("body")).toContainText(
                fixtures[1].users[ownerIndex].name,
              );
              await expect(page.locator("body")).not.toContainText(
                fixtures[0].young.name,
              );
              if (ownerIndex === 0) {
                await expect(page.locator("body")).toContainText(
                  fixtures[1].course.nameEn as string,
                );
                await expect(page.locator("body")).not.toContainText(
                  fixtures[0].course.nameEn as string,
                );
              }
              releaseOld();
              await expect(page.locator("body")).toContainText(
                fixtures[1].young.name,
              );
              await expect(page.locator("body")).not.toContainText(
                fixtures[0].young.name,
              );

              expect(
                await page.evaluate(
                  () =>
                    (
                      window as typeof window & {
                        calendarOldDocument?: boolean;
                      }
                    ).calendarOldDocument,
                ),
              ).toBe(true);
              expect(
                await page.evaluate(
                  () =>
                    (window as typeof window & { calendarOwnerLeak?: boolean })
                      .calendarOwnerLeak,
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
              page.off("close", releaseOld);
            }
            if (errors.length === 1) throw errors[0];
            if (errors.length)
              throw new AggregateError(
                errors,
                "Calendar owner workflow failed",
              );
          }
        }
      },
      { accountIndex: 0, calendarTokenCreated: true },
    );
    // The read owner drains every tagged request before these independent state
    // checks. calendarRun already verifies the first account; verify the other
    // three each acquired exactly one feed credential, with its own audit.
    await calendarDb(async (db) => {
      for (const { id: userId } of fixtures
        .flatMap(({ users }) => users)
        .slice(1)) {
        expect(
          await db.user.findUniqueOrThrow({
            where: { id: userId },
            select: { calendarFeedToken: true },
          }),
        ).toEqual({ calendarFeedToken: expect.any(String) });
        expect(
          await db.auditLog.findMany({
            where: { userId },
            select: {
              action: true,
              channel: true,
              outcome: true,
              targetId: true,
              targetType: true,
              userId: true,
              subjectUserId: true,
            },
          }),
        ).toEqual([
          {
            action: "account_calendar_token_create",
            channel: "system",
            outcome: "success",
            targetId: userId,
            targetType: "calendar_feed",
            userId,
            subjectUserId: userId,
          },
        ]);
      }
    });
  });
});
