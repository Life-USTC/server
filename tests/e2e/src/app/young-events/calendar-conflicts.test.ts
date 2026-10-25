import { expect } from "@playwright/test";
import { test } from "../../../utils/calendar-presentation-fixture";

for (const viewport of [
  { name: "desktop", width: 1280, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
]) {
  for (const accountIndex of [0, 1] as const) {
    test(`young-event.known-calendar-conflicts ${viewport.name} owner ${accountIndex}`, {
      tag: "@Young/Web",
    }, async ({ page, calendar, calendarDb, calendarRun }) => {
      const time = (clock: string) => `${calendar.date}T${clock}:00+08:00`;
      const previousDay = new Date(
        Date.parse(`${calendar.date}T00:00:00Z`) - 86_400_000,
      )
        .toISOString()
        .slice(0, 10);
      const cases = [
        {
          id: "class",
          name: "Class overlap",
          start: time("09:30"),
          end: time("10:30"),
          conflict: accountIndex === 0,
        },
        {
          id: "exam",
          name: "Exam overlap",
          start: time("13:30"),
          end: time("14:30"),
          conflict: accountIndex === 0,
        },
        {
          id: "free",
          name: "Free lecture",
          start: time("11:00"),
          end: time("12:00"),
          conflict: false,
        },
        {
          id: "touching",
          name: "Touching class endpoint",
          start: time("10:00"),
          end: time("11:00"),
          conflict: false,
        },
        {
          id: "point",
          name: "End time unconfirmed",
          start: time("09:45"),
          end: null,
          conflict: false,
        },
        {
          id: "workshop",
          name: "Subscribed workshop overlap",
          start: time("16:30"),
          end: time("17:30"),
          conflict: true,
        },
        {
          id: "overnight",
          name: "Overnight session overlap",
          start: time("00:30"),
          end: time("01:30"),
          conflict: accountIndex === 0,
        },
        {
          id: "registration",
          name: "Registration window only",
          start: time("18:00"),
          end: time("19:00"),
          conflict: false,
        },
        {
          id: "series",
          name: "Series window unconfirmed",
          start: time("08:00"),
          end: time("18:00"),
          conflict: false,
          categoryCode: "1",
        },
        {
          id: "campaign",
          name: "Submission campaign",
          start: `${previousDay}T00:00:00+08:00`,
          end: time("23:45"),
          conflict: false,
          formCode: "1",
        },
      ];
      const ids = await calendarDb(async (db) => {
        await db.youngEvent.update({
          where: { youngId: calendar.young.youngId },
          data: {
            name: "Subscribed workshop",
            startAt: new Date(time("16:00")),
            endAt: new Date(time("17:00")),
            categoryCode: "0",
            formCode: "0",
          },
        });
        await db.exam.create({
          data: {
            sectionId: calendar.section.id,
            jwId: calendar.section.jwId + 10,
            examDate: new Date(`${calendar.date}T00:00:00Z`),
            startTime: null,
            endTime: null,
            examType: 2,
            examTakeCount: 1,
            examMode: "Time unconfirmed",
          },
        });
        const records = [];
        for (const row of cases) {
          records.push(
            await db.youngEvent.create({
              data: {
                youngId: `${calendar.young.youngId}-${row.id}`,
                name: row.name,
                startAt: new Date(row.start),
                endAt: row.end ? new Date(row.end) : null,
                applyStartAt: new Date(time("09:00")),
                applyEndAt: new Date(time("10:00")),
                categoryCode: row.categoryCode ?? "0",
                formCode: row.formCode ?? "0",
                isActive: true,
                rawJson: {},
              },
            }),
          );
        }
        for (const user of calendar.users)
          await db.userYoungEventSubscription.create({
            data: {
              userId: user.id,
              youngId: `${calendar.young.youngId}-campaign`,
              observedState: "{}",
            },
          });
        const overnight = await db.youngEvent.create({
          data: {
            youngId: `${calendar.young.youngId}-subscribed-night`,
            name: "Subscribed overnight session",
            startAt: new Date(`${previousDay}T00:00:00+08:00`),
            endAt: new Date(time("23:45")),
            categoryCode: "1",
            formCode: "0",
            isActive: true,
            rawJson: {},
            places: [
              {
                placeInfo: "Night lab",
                placeSt: `${previousDay} 23:00:00`,
                placeEt: `${calendar.date} 01:00:00`,
              },
            ],
          },
        });
        await db.userYoungEventSubscription.create({
          data: {
            userId: calendar.users[0].id,
            youngId: overnight.youngId,
            observedState: "{}",
          },
        });
        return records.map((row) => row.youngId);
      });
      await calendarRun(
        async () => {
          await page.setViewportSize(viewport);
          await page
            .context()
            .addCookies([
              { name: "NEXT_LOCALE", value: "en-us", url: calendar.origin },
              await calendar.createSignedSessionCookie(
                calendar.users[accountIndex].id,
              ),
            ]);
          const responseReady = page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname ===
              "/api/workspace/calendar/events",
          );
          await page.goto(
            `/catalog/young-events/calendar?view=day&date=${calendar.date}`,
          );
          const response = await responseReady;
          expect(response.status()).toBe(200);
          expect(response.headers()["cache-control"]).toContain("no-store");
          const body = await response.json();
          await expect(
            page.getByTestId("young-calendar-conflict-status"),
          ).toContainText("Conflicts use");
          const container = page.getByTestId(
            viewport.name === "mobile"
              ? "young-calendar-agenda"
              : "young-calendar-grid",
          );
          for (const [index, row] of cases.entries()) {
            const link = container.locator(
              `a[href*="/catalog/young-events/${ids[index]}"]`,
            );
            await expect(link).toBeVisible();
            if (row.conflict)
              await expect(link).toContainText(
                "Overlaps an existing calendar event",
              );
            else
              await expect(link).not.toContainText(
                "Overlaps an existing calendar event",
              );
          }
          await expect(
            container.locator(
              `a[href$="/catalog/young-events/${calendar.young.youngId}"]`,
            ),
          ).not.toContainText("Overlaps an existing calendar event");
          expect(
            body.data.some(
              (item: { type: string }) => item.type === "schedule",
            ),
          ).toBe(accountIndex === 0);
          expect(
            body.data.some((item: { type: string }) => item.type === "exam"),
          ).toBe(accountIndex === 0);
          expect(
            body.data.find(
              (item: { title: string }) => item.title === "Submission campaign",
            ).conflictIntervals,
          ).toEqual([]);
          if (accountIndex === 0) {
            expect(
              body.data.find(
                (item: { type: string; hasTime: boolean }) =>
                  item.type === "exam" && !item.hasTime,
              ).conflictIntervals,
            ).toEqual([]);
            expect(
              body.data.find(
                (item: { title: string }) =>
                  item.title === "Subscribed overnight session",
              ).conflictIntervals,
            ).toEqual([
              {
                startAt: `${previousDay}T23:00:00+08:00`,
                endAt: time("01:00"),
              },
            ]);
          } else
            expect(
              body.data.some(
                (item: { title: string }) =>
                  item.title === "Subscribed overnight session",
              ),
            ).toBe(false);
          await page.goto(
            `/catalog/young-events/calendar?view=day&date=${calendar.date}&timeBasis=registration`,
          );
          await expect(
            page.getByTestId("young-calendar-conflict-status"),
          ).toHaveCount(0);
          await expect(page.getByTestId("young-calendar")).not.toContainText(
            "Overlaps an existing calendar event",
          );
        },
        { accountIndex, calendarTokenCreated: false },
      );
    });
  }
}
