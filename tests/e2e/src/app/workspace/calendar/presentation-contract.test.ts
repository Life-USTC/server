import { expect, type Page } from "@playwright/test";
import {
  type CalendarFixture,
  test,
} from "../../../../utils/calendar-presentation-fixture";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";

async function owner(page: Page, fixture: CalendarFixture, index: number) {
  await page.context().clearCookies();
  await page
    .context()
    .addCookies([
      await fixture.createSignedSessionCookie(fixture.users[index].id),
      { name: "NEXT_LOCALE", value: "en-us", url: fixture.origin },
    ]);
}
async function activityCalendar(page: Page, fixture: CalendarFixture) {
  await owner(page, fixture, 1);
  await gotoAndWaitForReady(page, "/workspace/calendar");
  await page.locator("#personal-activity-date").fill(fixture.activityDate);
  await page.locator("#personal-activity-date").press("Tab");
}

for (const [view, label] of [
  ["semester", /^(Semester|学期)$/],
  ["month", /^(Month|月)$/],
  ["week", /^(Week|周)$/],
] as const) {
  test(`calendar.academic-view ${view}`, { tag: "@Calendar/Web" }, async ({
    page,
    calendar: fixture,
    calendarRun,
  }) => {
    await calendarRun(
      async () => {
        await page.setViewportSize({ width: 1280, height: 900 });
        await owner(page, fixture, 0);
        await gotoAndWaitForReady(page, fixture.academicUrl(view));
        await expect(page.getByRole("radio", { name: label })).toBeChecked();
        await expect(page.getByTestId("workspace-calendar-grid")).toBeVisible();
        await expect(
          page
            .getByTestId("workspace-calendar-grid")
            .getByRole("link", { name: new RegExp(fixture.young.name) }),
        ).toBeVisible();
        await expect(
          page
            .getByTestId("workspace-calendar-grid")
            .locator(`a[href="/catalog/sections/${fixture.section.jwId}"]`)
            .first(),
        ).toBeVisible();
      },
      { accountIndex: 0, calendarTokenCreated: true },
    );
  });
}
for (const locale of ["en-us", "zh-cn"]) {
  for (const width of [1280, 1024, 390]) {
    test(`calendar.day-navigation ${locale} ${width}`, {
      tag: "@Calendar/Web",
    }, async ({ page, calendar: fixture, calendarRun }) => {
      const previousDay = locale === "en-us" ? "Previous day" : "前一天";
      const nextDay = locale === "en-us" ? "Next day" : "后一天";
      const previousDayName = previousDay;
      const nextDayName = nextDay;
      await calendarRun(
        async () => {
          await owner(page, fixture, 0);
          await page
            .context()
            .addCookies([
              { name: "NEXT_LOCALE", value: locale, url: fixture.origin },
            ]);
          await page.setViewportSize({ width, height: 900 });
          await gotoAndWaitForReady(page, fixture.academicUrl());
          await expect(
            page.getByRole("radio", { name: /^(Day|日)$/ }),
          ).toHaveCount(1);
          if (width < 1280) {
            await page
              .getByRole("button", {
                name: /更多.*操作|More calendar actions/i,
              })
              .click();
            await expect(
              page
                .getByRole("menuitem")
                .filter({ hasText: /活动订阅|Activity subscriptions/i }),
            ).toHaveAttribute("href", "/workspace/subscriptions/activities");
            await page.keyboard.press("Escape");
          } else {
            await expect(
              page.locator(
                'main a[href="/workspace/subscriptions/activities"]',
              ),
            ).toBeVisible();
          }
          await page.getByRole("radio", { name: /^(Day|日)$/ }).click();
          await expect(page).toHaveURL(/calendarView=day/);
          const agenda = page
            .getByTestId("calendar-agenda")
            .filter({ visible: true });
          await expect(agenda.locator("section")).toHaveCount(1);
          await expect(agenda.locator(`#agenda-${fixture.date}`)).toBeVisible();
          await expect(
            agenda.locator(
              `a[href="/catalog/sections/${fixture.section.jwId}"]`,
            ),
          ).toContainText("09:00");
          await expect(
            agenda.locator('a[href="/workspace/exams"]'),
          ).toContainText("13:00");
          await expect(
            agenda.getByRole("link", {
              name: new RegExp(fixture.homework.title),
            }),
          ).toContainText("12:00");
          await expect(
            agenda.getByRole("link", {
              name: new RegExp(fixture.todo.title),
            }),
          ).toBeVisible();
          await expect(
            agenda.getByRole("link", {
              name: new RegExp(fixture.young.name),
            }),
          ).toHaveCount(0);

          await page
            .getByRole("button", { name: nextDayName, exact: true })
            .click();
          await expect(page).toHaveURL(
            new RegExp(`calendarDay=${fixture.activityDate}`),
          );
          await expect(agenda.locator("section")).toHaveCount(1);
          await expect(
            agenda.getByRole("link", {
              name: new RegExp(fixture.young.name),
            }),
          ).toContainText("16:00");
          await expect(
            agenda.locator(
              `a[href="/catalog/sections/${fixture.section.jwId}"]`,
            ),
          ).toHaveCount(0);
          await page.reload();
          await expect(
            page.getByRole("radio", { name: /^(Day|日)$/ }),
          ).toBeChecked();
          await expect(
            agenda.locator(`#agenda-${fixture.activityDate}`),
          ).toBeVisible();
          await expect(
            agenda.getByRole("link", {
              name: new RegExp(fixture.young.name),
            }),
          ).toBeVisible();
          await page
            .getByRole("button", { name: previousDayName, exact: true })
            .click();
          await expect(agenda.locator(`#agenda-${fixture.date}`)).toBeVisible();
          await page
            .getByRole("button", { name: nextDayName, exact: true })
            .click();
          await page.getByRole("button", { name: /^(Today|今天)$/ }).click();
          await expect(agenda.locator("section")).toHaveCount(1);
          const today = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Shanghai",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(new Date());
          await expect(page).toHaveURL(new RegExp(`calendarDay=${today}`));
          await expect(agenda.locator(`#agenda-${today}`)).toBeVisible();
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
        },
        { accountIndex: 0, calendarTokenCreated: true },
      );
    });
  }
}
for (const [view, label] of [
  ["day", /^(Day|日)$/],
  ["week", /^(Week|周)$/],
  ["month", /^(Month|月)$/],
] as const) {
  test(`calendar.activity-view ${view}`, { tag: "@Calendar/Web" }, async ({
    page,
    calendar: fixture,
    calendarRun,
  }) => {
    await calendarRun(
      async () => {
        await page.setViewportSize({ width: 1280, height: 900 });
        await activityCalendar(page, fixture);
        await expect(
          page.getByRole("group", { name: /^(Calendar view|日历视图)$/ }),
        ).toBeVisible();
        const control = page.getByRole("radio", { name: label });
        await control.click();

        await expect(control).toHaveAttribute("data-state", "on");
        await control.click();
        await expect(control).toBeChecked();
        const viewSurface =
          view === "day"
            ? page.getByTestId("calendar-agenda").filter({ visible: true })
            : page.getByRole("grid").filter({ visible: true });
        await expect(
          viewSurface.getByRole("link", {
            name: new RegExp(fixture.young.name),
          }),
        ).toBeVisible();
        await expect(
          page.locator(`a[href="/catalog/sections/${fixture.section.jwId}"]`),
        ).toHaveCount(0);
      },
      { accountIndex: 1, calendarTokenCreated: true },
    );
  });
}

for (const view of ["semester", "month", "week"]) {
  test(`calendar.week-starts-monday academic ${view}`, {
    tag: "@Calendar/Web",
  }, async ({ page, calendar: fixture, calendarRun }) => {
    await calendarRun(
      async () => {
        await page.setViewportSize({ width: 1280, height: 900 });
        await owner(page, fixture, 0);
        await gotoAndWaitForReady(page, fixture.academicUrl(view));

        const headers = page
          .getByTestId("workspace-calendar-grid")
          .getByRole("columnheader");
        await expect(headers).toHaveCount(8);
        expect((await headers.allTextContents()).slice(1)).toEqual([
          "Mon",
          "Tue",
          "Wed",
          "Thu",
          "Fri",
          "Sat",
          "Sun",
        ]);
        const courseCell = page
          .getByTestId("workspace-calendar-grid")
          .locator(`a[href="/catalog/sections/${fixture.section.jwId}"]`)
          .first()
          .locator('xpath=ancestor::*[@role="gridcell"][1]');
        await expect(courseCell).toContainText("04-29");
        expect(
          await courseCell.evaluate((cell) =>
            Array.from(
              cell.parentElement?.querySelectorAll('[role="gridcell"]') ?? [],
            ).indexOf(cell),
          ),
        ).toBe(2);
      },
      { accountIndex: 0, calendarTokenCreated: true },
    );
  });
}
for (const [view, label] of [
  ["week", /^(Week|周)$/],
  ["month", /^(Month|月)$/],
] as const) {
  test(`calendar.week-starts-monday activity ${view}`, {
    tag: "@Calendar/Web",
  }, async ({ page, calendar: fixture, calendarRun }) => {
    await calendarRun(
      async () => {
        await page.setViewportSize({ width: 1280, height: 900 });
        await activityCalendar(page, fixture);
        await page.getByRole("radio", { name: label }).click();
        const headers = page
          .getByRole("grid")
          .filter({ visible: true })
          .getByRole("columnheader");
        await expect(headers).toHaveCount(7);
        expect(await headers.allTextContents()).toEqual([
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ]);
      },
      { accountIndex: 1, calendarTokenCreated: true },
    );
  });
}
test("calendar.public-section-lecture-fields", {
  tag: "@Calendar/Web",
}, async ({ page, calendar: fixture, calendarRun }) => {
  await calendarRun(
    async () => {
      await page.context().clearCookies();
      await page
        .context()
        .addCookies([
          { name: "NEXT_LOCALE", value: "en-us", url: fixture.origin },
        ]);
      await gotoAndWaitForReady(
        page,
        `/catalog/sections/${fixture.section.jwId}/calendar`,
      );
      const lectureTable = page.getByTestId("section-calendar-table");
      const lecture = lectureTable
        .getByRole("row")
        .filter({ hasText: "09:00" });
      const cells = lecture.getByRole("cell");
      await expect(cells.nth(1)).toHaveText(fixture.date);
      await expect(cells.nth(2)).toContainText("8");
      await expect(cells.nth(3)).toContainText("09:00");
      await expect(cells.nth(4)).toContainText("Calendar teaching room");
    },
    { accountIndex: 0, calendarTokenCreated: false },
  );
});

for (const timezoneId of ["UTC", "Asia/Shanghai"]) {
  test.describe(`calendar.event-card-types ${timezoneId}`, () => {
    test.use({ timezoneId });
    for (const width of [1280, 390]) {
      test(`${width}`, { tag: "@Calendar/Web" }, async ({
        page,
        calendar: fixture,
        calendarRun,
      }) => {
        await calendarRun(
          async () => {
            await owner(page, fixture, 0);
            await page.setViewportSize({ width, height: 900 });
            await gotoAndWaitForReady(page, fixture.academicUrl());
            const surface = page
              .getByTestId(
                width >= 1280 ? "workspace-calendar-grid" : "calendar-agenda",
              )
              .filter({ visible: true });
            const course = surface
              .locator(`a[href="/catalog/sections/${fixture.section.jwId}"]`)
              .first();
            await expect(course).toContainText(fixture.course.nameEn ?? "");
            await expect(course).toContainText("09:00");
            const exam = surface.locator('a[href="/workspace/exams"]').first();
            await expect(exam).toBeVisible();
            await expect(exam).toContainText(/Exam/i);
            await expect(exam).toContainText("13:00");
            const homework = surface.getByRole("link", {
              name: new RegExp(fixture.homework.title),
            });
            await expect(homework).toBeVisible();
            await expect(homework).toContainText("12:00");
            const todo = surface.getByRole("link", {
              name: new RegExp(fixture.todo.title),
            });
            await expect(todo).toBeVisible();
            await expect(todo).toContainText("15:00");
            if (width < 1280) {
              const day = surface
                .locator(`#agenda-${fixture.date}`)
                .locator("xpath=ancestor::section[1]");
              await expect(day.locator('[data-slot="item-title"]')).toHaveText([
                fixture.course.nameEn ?? "",
                fixture.homework.title,
                fixture.course.nameEn ?? "",
                fixture.todo.title,
              ]);
            }
            const activity = surface.getByRole("link", {
              name: new RegExp(fixture.young.name),
            });
            await expect(activity).toBeVisible();
            await expect(activity).toContainText("16:00");
            await expect(activity).toHaveAttribute(
              "href",
              `/catalog/young-events/${fixture.young.youngId}`,
            );
          },
          { accountIndex: 0, calendarTokenCreated: true },
        );
      });
    }
  });
}

// Keep mobile semester capability real across both pagination and inclusive date-window boundaries.
test("calendar.mobile-long-semester-owner-isolation", {
  tag: "@Calendar/Web",
}, async ({ page, calendar: fixture, calendarDb, calendarRun }) => {
  const prefix = `${fixture.young.youngId}-long`;
  const entries = Array.from({ length: 501 }, (_, index) => ({
    youngId: `${prefix}-${index}`,
    name: `Long calendar activity ${index}`,
    startAt: new Date(`${fixture.activityDate}T16:00:00+08:00`),
    endAt: new Date(
      index === 0
        ? "2027-04-13T17:00:00+08:00"
        : `${fixture.activityDate}T17:00:00+08:00`,
    ),
    isActive: true,
    location: "Calendar activity room",
    rawJson: {},
  }));
  await calendarDb(async (db) => {
    const semesterId = fixture.section.semesterId;
    if (semesterId === null)
      throw new Error("Academic calendar fixture requires a semester");
    await db.semester.update({
      where: { id: semesterId },
      data: {
        startDate: new Date("2026-04-01"),
        endDate: new Date("2027-04-12"),
      },
    });
    await db.youngEvent.createMany({
      data: [
        ...entries,
        {
          youngId: `${prefix}-last`,
          name: "Last semester activity",
          startAt: new Date("2027-04-12T16:00:00+08:00"),
          endAt: new Date("2027-04-12T17:00:00+08:00"),
          isActive: true,
          location: "Final calendar room",
          rawJson: {},
        },
      ],
    });
    await db.userYoungEventSubscription.createMany({
      data: [...entries.map(({ youngId }) => youngId), `${prefix}-last`].map(
        (youngId) => ({
          userId: fixture.users[0].id,
          youngId,
          observedState: "{}",
        }),
      ),
    });
  });
  await calendarRun(
    async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await owner(page, fixture, 0);
      await gotoAndWaitForReady(page, fixture.academicUrl());
      await page.getByRole("radio", { name: /^(Semester|学期)$/ }).click();
      const agenda = page
        .getByTestId("calendar-agenda")
        .filter({ visible: true });
      const lastDay = agenda
        .locator("#agenda-2027-04-12")
        .locator("xpath=ancestor::section[1]");
      await expect(
        lastDay.getByRole("link", { name: /Last semester activity/ }),
      ).toHaveAttribute("href", `/catalog/young-events/${prefix}-last`);
      expect(await agenda.locator("section").count()).toBeGreaterThan(366);
      const firstDay = agenda
        .locator(`#agenda-${fixture.activityDate}`)
        .locator("xpath=ancestor::section[1]");
      await expect(
        firstDay.locator('a[href^="/catalog/young-events/"]'),
      ).toHaveCount(502);
      await expect(
        firstDay.locator(`a[href="/catalog/young-events/${prefix}-500"]`),
      ).toHaveCount(1);
      await expect(
        lastDay.locator(`a[href="/catalog/young-events/${prefix}-0"]`),
      ).toHaveCount(1);
      await lastDay
        .getByRole("link", { name: /Last semester activity/ })
        .scrollIntoViewIfNeeded();
      await expect(lastDay).toContainText("Final calendar room");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);

      await activityCalendar(page, fixture);
      const activityAgenda = page
        .getByTestId("calendar-agenda")
        .filter({ visible: true });
      await expect(
        activityAgenda.getByRole("link", {
          name: new RegExp(fixture.young.name),
        }),
      ).toBeVisible();
      await expect(
        activityAgenda.locator(`a[href^="/catalog/young-events/${prefix}"]`),
      ).toHaveCount(0);
      await expect(
        activityAgenda.locator(
          `a[href="/catalog/sections/${fixture.section.jwId}"]`,
        ),
      ).toHaveCount(0);
    },
    { accountIndex: 0, calendarTokenCreated: true },
  );
});
