import { expect, test } from "@playwright/test";
import { createCalendarContractFixture } from "../../../../utils/calendar-contract";
import { PLAYWRIGHT_BASE_URL } from "../../../../utils/e2e-db/core";
import { withE2ePrisma } from "../../../../utils/e2e-db/prisma";
import { createSignedSessionCookie } from "../../../../utils/workspace-task-filters";

test("calendar.activity-owner-transition", async ({ page }) => {
  test.setTimeout(120_000);
  const fixtures = [
    await createCalendarContractFixture(),
    await createCalendarContractFixture(),
  ];
  const now = new Date();
  const shifted = new Date(now.getTime() + 8 * 3600000);
  const today = shifted.toISOString().slice(0, 10);
  const monday = new Date(
    shifted.getTime() - ((shifted.getUTCDay() + 6) % 7) * 86400000,
  )
    .toISOString()
    .slice(0, 10);
  const semester = await withE2ePrisma(async (db) => {
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
    return semester;
  });
  let releaseOld = () => {};
  try {
    for (const ownerIndex of [0, 1]) {
      for (const pending of [false, true]) {
        let held = false;
        let oldSeen = () => {};
        const oldIntercepted = new Promise<void>((resolve) => {
          oldSeen = resolve;
        });
        const release = new Promise<void>((resolve) => {
          releaseOld = resolve;
        });
        await page.unrouteAll({ behavior: "wait" });
        await page.route(
          "**/api/workspace/calendar/events?**",
          async (route) => {
            const response = await route.fetch();
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
              oldSeen();
              await release;
            }
            await route.fulfill({ response }).catch((error) => {
              if (!route.request().failure()) throw error;
            });
          },
        );
        await page.context().clearCookies();
        await page
          .context()
          .addCookies([
            await createSignedSessionCookie(fixtures[0].users[ownerIndex].id),
            { name: "NEXT_LOCALE", value: "en-us", url: PLAYWRIGHT_BASE_URL },
          ]);
        await page.goto(`/workspace/calendar?calendarWeek=${monday}`);
        if (pending) await oldIntercepted;
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
            await createSignedSessionCookie(fixtures[1].users[ownerIndex].id),
            { name: "NEXT_LOCALE", value: "en-us", url: PLAYWRIGHT_BASE_URL },
          ]);
        await page
          .getByTestId("app-sidebar")
          .getByRole("link", { name: "Calendar", exact: true })
          .filter({ visible: true })
          .click();
        await expect(page).toHaveURL(
          `${PLAYWRIGHT_BASE_URL}/workspace/calendar`,
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
        await page.screenshot({
          path: `/tmp/life-spec-business-calendar-owner-after-${ownerIndex}-${pending}.png`,
          fullPage: true,
        });
        expect(
          await page.evaluate(
            () =>
              (window as typeof window & { calendarOldDocument?: boolean })
                .calendarOldDocument,
          ),
        ).toBe(true);
        expect(
          await page.evaluate(
            () =>
              (window as typeof window & { calendarOwnerLeak?: boolean })
                .calendarOwnerLeak,
          ),
        ).toBe(false);
      }
    }
  } finally {
    releaseOld();
    await page.unrouteAll({ behavior: "wait" });
    for (const fixture of fixtures) await fixture.cleanup();
    await withE2ePrisma((db) =>
      db.semester.delete({ where: { id: semester.id } }),
    );
  }
});
