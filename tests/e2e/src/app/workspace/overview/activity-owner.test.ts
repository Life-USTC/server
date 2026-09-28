import { expect, test } from "@playwright/test";
import { createCalendarContractFixture } from "../../../../utils/calendar-contract";
import { PLAYWRIGHT_BASE_URL } from "../../../../utils/e2e-db/core";
import { withE2ePrisma } from "../../../../utils/e2e-db/prisma";
import { createSignedSessionCookie } from "../../../../utils/workspace-task-filters";

test("overview.activity-owner-transition", async ({ page }) => {
  test.setTimeout(120_000);
  const fixtures = [
    await createCalendarContractFixture(),
    await createCalendarContractFixture(),
  ];
  const now = new Date();
  const shifted = new Date(now.getTime() + 8 * 3600000);
  const monday = new Date(
    shifted.getTime() - ((shifted.getUTCDay() + 6) % 7) * 86400000,
  )
    .toISOString()
    .slice(0, 10);
  await withE2ePrisma(async (db) => {
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
  let releaseOld = () => {};
  try {
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
      await page.route("**/api/workspace/calendar/events?**", async (route) => {
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
      });
      await page.context().clearCookies();
      await page
        .context()
        .addCookies([
          await createSignedSessionCookie(fixtures[0].users[0].id),
          { name: "NEXT_LOCALE", value: "en-us", url: PLAYWRIGHT_BASE_URL },
        ]);
      await page.goto(`/workspace/overview?overviewWeek=${monday}`);
      const focus = page.getByTestId("workspace-overview-focus");
      if (pending) {
        await oldIntercepted;
        await expect(focus.getByRole("status")).toContainText("Loading");
        await expect(focus).not.toContainText("Nothing is due or scheduled");
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
          await createSignedSessionCookie(fixtures[1].users[0].id),
          { name: "NEXT_LOCALE", value: "en-us", url: PLAYWRIGHT_BASE_URL },
        ]);
      await page
        .getByTestId("app-sidebar")
        .getByRole("link", { name: "Today", exact: true })
        .filter({ visible: true })
        .click();
      await expect(page).toHaveURL(`${PLAYWRIGHT_BASE_URL}/workspace/overview`);
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
    }
  } finally {
    releaseOld();
    await page.unrouteAll({ behavior: "wait" });
    for (const fixture of fixtures) await fixture.cleanup();
  }
});
