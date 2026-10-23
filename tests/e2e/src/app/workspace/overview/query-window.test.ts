import { expect } from "@playwright/test";
import { test } from "../../../../utils/calendar-presentation-fixture";

test("overview.legacy-preview-week", { tag: "@Overview/Web" }, async ({
  page,
  calendar,
  calendarDb,
  calendarRun,
}) => {
  await calendarDb((db) =>
    db.schedule.create({
      data: {
        sectionId: calendar.section.id,
        scheduleGroupId: calendar.group.id,
        date: new Date("2026-05-13T00:00:00Z"),
        weekday: 3,
        startTime: 900,
        endTime: 1000,
        startUnit: 1,
        endUnit: 2,
        weekIndex: 10,
        periods: 2,
        customPlace: "Later preview week room",
      },
    }),
  );
  await calendarRun(
    async () => {
      await page
        .context()
        .addCookies([
          await calendar.createSignedSessionCookie(calendar.users[0].id),
          { name: "NEXT_LOCALE", value: "en-us", url: calendar.origin },
        ]);
      const snapshotAt = "2026-04-29T09:30:00+08:00";
      for (const overviewWeek of ["2026-05-11", null]) {
        const search = new URLSearchParams({ snapshotAt });
        if (overviewWeek) search.set("overviewWeek", overviewWeek);
        const projection = page.waitForResponse((response) => {
          return new URL(response.url()).pathname === "/_internal/home/viewer";
        });
        await page.goto(`/workspace/overview?${search}`);
        await expect(page).toHaveURL(`${calendar.origin}/?${search}`);
        const response = await projection;
        expect(response.ok()).toBe(true);
        const body = await response.json();
        expect(body.overviewWeek).toBe(overviewWeek);
        expect(body.overview.calendar.todayDate).toBe("2026-04-29");
        expect(
          body.overview.calendar.allSessions.map(
            (session: { dateKey: string }) => session.dateKey,
          ),
        ).toEqual(overviewWeek ? ["2026-04-29", "2026-05-13"] : ["2026-04-29"]);
        await expect(
          page.getByTestId("workspace-overview-focus"),
        ).toContainText("Calendar teaching room");
        await expect(
          page.getByTestId("workspace-overview-focus"),
        ).not.toContainText("Later preview week room");
      }
    },
    { accountIndex: 0, calendarTokenCreated: false },
  );
});
