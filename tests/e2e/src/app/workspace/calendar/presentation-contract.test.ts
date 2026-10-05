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
  ["semester", /^(This semester|学期)$/],
  ["month", /^(This month|本月)$/],
  ["week", /^(This week|本周)$/],
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
  for (const width of [1280, 390]) {
    test(
      `calendar.day-navigation ${locale} ${width}`,
      { tag: "@Calendar/Web" },
      async ({ page, calendar: fixture, calendarRun }, testInfo) => {
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
            await page.getByRole("radio", { name: /^(Day|日)$/ }).click();
            await expect(page).toHaveURL(/calendarView=day/);
            const agenda = page
              .getByTestId("calendar-agenda")
              .filter({ visible: true });
            await expect(agenda.locator("section")).toHaveCount(1);
            await expect(
              agenda.locator(`#agenda-${fixture.date}`),
            ).toBeVisible();
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
            await page.screenshot({
              path: testInfo.outputPath(`academic-day-${locale}-${width}.png`),
              fullPage: true,
            });
            await page
              .getByRole("button", { name: /^(Next day|后一天)$/ })
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
              .getByRole("button", { name: /^(Previous day|前一天)$/ })
              .click();
            await expect(
              agenda.locator(`#agenda-${fixture.date}`),
            ).toBeVisible();
            await page
              .getByRole("button", { name: /^(Next day|后一天)$/ })
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
      },
    );
  }
}
for (const [view, label] of [
  ["day", /^(Day|日)$/],
  ["week", /^(Week|周)$/],
  ["month", /^(Month|月)$/],
] as const) {
  test(
    `calendar.activity-view ${view}`,
    { tag: "@Calendar/Web" },
    async ({ page, calendar: fixture, calendarRun }, testInfo) => {
      await calendarRun(
        async () => {
          await page.setViewportSize({ width: 1280, height: 900 });
          await activityCalendar(page, fixture);
          const control = page.getByRole("radio", { name: label });
          await control.click();
          await control.locator("..").screenshot({
            path: testInfo.outputPath("calendar-view-controls.png"),
          });
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
    },
  );
}

for (const view of ["semester", "month", "week"]) {
  test(
    `calendar.week-starts-monday academic ${view}`,
    { tag: "@Calendar/Web" },
    async ({ page, calendar: fixture, calendarRun }, testInfo) => {
      await calendarRun(
        async () => {
          await page.setViewportSize({ width: 1280, height: 900 });
          await owner(page, fixture, 0);
          await gotoAndWaitForReady(page, fixture.academicUrl(view));
          if (view === "week")
            await page.screenshot({
              path: testInfo.outputPath("academic-week.png"),
              fullPage: true,
            });
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
    },
  );
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
                width >= 768 ? "workspace-calendar-grid" : "calendar-agenda",
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
            if (width < 768) {
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
