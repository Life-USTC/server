/**
 * E2E tests for the calendar workspace (`/workspace/calendar`)
 *
 * ## Data Represented (calendar.yml → personal-calendar-view.display.fields)
 * - calendarEvents (schedules + exams + homeworks + todos)
 * - schedule.date, startTime, endTime
 * - exam.examDate, startTime, endTime, examMode, examRooms
 * - homework.submissionDueAt
 * - todo.dueAt
 * - Week numbers
 * - Weekday labels (Mon-Sun)
 *
 * ## Features
 * - View tabs: semester (default) / day / month / week
 * - Navigation: prev/next semester, month, or week
 * - Section links from calendar events
 * - Copy calendar link button (iCal)
 *
 * ## Edge Cases
 * - Unauthenticated legacy tab → protected semantic route, then sign-in
 * - Different layout per view mode
 */
import { expect } from "@playwright/test";
import { test } from "../../../../utils/academic-events";
import { test as calendarTest } from "../../../../utils/calendar-presentation-fixture";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";

test.describe("仪表盘日历", () => {
  test.describe.configure({ mode: "parallel" });

  test("登录后显示日历，包含班级事件链接和星期标签", async ({
    page,
    calendarUrl,
    homeworkRun,
  }) => {
    await homeworkRun(
      async () => {
        await gotoAndWaitForReady(page, calendarUrl);

        await expect(page.locator("#main-content")).toBeVisible();

        // Weekday labels (Mon-Sun) — calendar.yml personal-calendar-view.display.fields
        await expect(
          page
            .getByTestId("workspace-calendar-grid")
            .getByText(/Sun|Mon|Tue|Wed|Thu|Fri|Sat|日|一|二|三|四|五|六/)
            .first(),
        ).toBeVisible();

        // Section links from schedule events
        const sectionLink = page
          .locator('a[href^="/catalog/sections/"]')
          .filter({ visible: true })
          .first();
        await expect(sectionLink).toBeVisible();
      },
      { calendarMessages: [], calendarTokenCreated: true },
    );
  });

  test("班级事件链接导航到班级详情", async ({
    page,
    calendarUrl,
    homeworkRun,
  }) => {
    await homeworkRun(
      async () => {
        await gotoAndWaitForReady(page, calendarUrl);

        const sectionLink = page
          .locator('a[href^="/catalog/sections/"]')
          .filter({ visible: true })
          .first();
        await expect(sectionLink).toBeVisible();
        await sectionLink.click();

        await expect(page).toHaveURL(/\/catalog\/sections\/\d+/);
      },
      { calendarMessages: [], calendarTokenCreated: true },
    );
  });

  test("考试卡片链接到考试标签", async ({ page, calendarUrl, homeworkRun }) => {
    await homeworkRun(
      async () => {
        await gotoAndWaitForReady(page, calendarUrl);

        const examLink = page.locator('a[href="/workspace/exams"]').first();
        await expect(examLink).toBeVisible();
        await examLink.click();
        await expect(page).toHaveURL(/\/workspace\/exams(?:\?.*)?$/);
      },
      { calendarMessages: [], calendarTokenCreated: true },
    );
  });

  test("学期导航控件可切换到其他学期", async ({
    page,
    calendarUrl,
    homeworkRun,
  }) => {
    await homeworkRun(
      async () => {
        await gotoAndWaitForReady(page, calendarUrl);

        // calendar.yml: Previous/next semester controls
        const previousSemester = page.getByRole("button", {
          name: /上一学期|Previous semester/i,
        });
        const nextSemester = page.getByRole("button", {
          name: /下一学期|Next semester/i,
        });
        await expect(previousSemester).toBeVisible();
        await expect(nextSemester).toBeVisible();

        const navigationButton = (await previousSemester.isEnabled())
          ? previousSemester
          : nextSemester;
        await expect(navigationButton).toBeEnabled();

        const beforeUrl = page.url();
        await navigationButton.click();
        await expect(page).toHaveURL(/calendarSemester=\d+/);
        await expect(page).not.toHaveURL(beforeUrl);
        await expect(page.locator("#main-content")).toBeVisible();
      },
      { calendarMessages: [], calendarTokenCreated: true },
    );
  });

  test("视图切换可在学期/月/周之间切换", async ({
    page,
    calendarUrl,
    homeworkRun,
  }) => {
    await homeworkRun(
      async () => {
        await gotoAndWaitForReady(page, calendarUrl);

        // calendar.yml: View tabs
        const calendarTabs = page.getByRole("group", {
          name: /日历|Calendar/i,
        });
        const monthTab = calendarTabs.getByRole("radio", {
          name: /本月|This month/i,
        });
        await monthTab.click();
        await expect(page).toHaveURL(/calendarView=month/);
        await expect(monthTab).toHaveAttribute("aria-checked", "true");
        const weekTab = calendarTabs.getByRole("radio", {
          name: /本周|This week/i,
        });
        await weekTab.click();
        await expect(page).toHaveURL(/calendarView=week/);
        await expect(weekTab).toHaveAttribute("aria-checked", "true");
      },
      { calendarMessages: [], calendarTokenCreated: true },
    );
  });

  test("ical.copyable-links", async ({
    page,
    academic,
    calendarUrl,
    homeworkRun,
  }) => {
    await homeworkRun(
      async ({ headers }) => {
        await page
          .context()
          .grantPermissions(["clipboard-read", "clipboard-write"]);
        await gotoAndWaitForReady(page, calendarUrl);

        const copyButton = page.getByRole("button", {
          name: /复制日历链接|iCal/i,
        });
        await expect(copyButton).toBeVisible();
        await copyButton.click();

        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        await dialog.getByRole("button", { name: /^复制$|^Copy$/i }).click();

        const clipboardText = await page.evaluate(async () =>
          navigator.clipboard.readText(),
        );
        expect(clipboardText).toMatch(/\/api\/calendar-feeds\/[^/]+\.ics$/);

        const calendarResponse = await page.request.get(clipboardText, {
          headers,
        });
        expect(calendarResponse.status()).toBe(200);
        await calendarResponse.body();
        expect(calendarResponse.headers()["content-type"]).toContain(
          "text/calendar",
        );
        await page.keyboard.press("Escape");
        await gotoAndWaitForReady(
          page,
          `/catalog/sections/${academic.section.jwId}`,
        );
        await page
          .getByTestId("detail-pinned-summary")
          .getByRole("button", { name: /添加到日历|Add to calendar/i })
          .first()
          .click();
        const sectionDialog = page.getByRole("dialog");
        const sectionUrl = await sectionDialog
          .locator("#calendar-url")
          .inputValue();
        expect(sectionUrl).toContain(
          `/api/catalog/sections/${academic.section.jwId}/calendar.ics`,
        );
        await sectionDialog
          .getByRole("button", { name: /复制|Copy/i })
          .first()
          .click();
        expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
          sectionUrl,
        );
        const sectionResponse = await page.request.get(sectionUrl, { headers });
        expect(sectionResponse.status()).toBe(200);
        expect(sectionResponse.headers()["content-type"]).toContain(
          "text/calendar",
        );
        expect(await sectionResponse.text()).toContain("BEGIN:VCALENDAR");
      },
      { calendarMessages: [], calendarTokenCreated: true },
    );
  });

  calendarTest(
    "calendar.mobile-agenda-first",
    async ({ page, calendar: fixture, calendarRun }) => {
      await calendarRun(
        async () => {
          await page
            .context()
            .grantPermissions(["clipboard-read", "clipboard-write"]);
          await page.setViewportSize({ height: 844, width: 390 });

          await page.context().clearCookies();
          await page
            .context()
            .addCookies([
              await fixture.createSignedSessionCookie(fixture.users[0].id),
            ]);
          await gotoAndWaitForReady(page, fixture.academicUrl());

          const agenda = page.getByTestId("calendar-agenda");
          await expect(agenda).toBeVisible();
          await expect(agenda.locator("section")).toHaveCount(7);
          await expect(agenda.locator("a").first()).toBeVisible();
          const courseEvent = agenda
            .locator(`a[href="/catalog/sections/${fixture.section.jwId}"]`)
            .first();
          await expect(
            courseEvent.locator('[data-slot="item-title"]'),
          ).not.toHaveText("");
          await expect(
            courseEvent.locator('[data-slot="item-description"]'),
          ).toContainText(/\d{1,2}:\d{2}/);
          await expect(courseEvent).toContainText("Calendar teaching room");
          await expect(
            agenda.getByText(fixture.homework.title).first(),
          ).toBeVisible();
          await expect(
            page.getByRole("radio", { name: /^(Day|日)$/ }),
          ).toBeVisible();
          await expect(
            page.getByRole("radio", { name: /^(This week|本周)$/ }),
          ).toBeVisible();

          const previous = page.getByRole("button", {
            name: /上一周|Previous week/i,
          });
          const today = page.getByRole("button", { name: /今天|Today/i });
          const next = page.getByRole("button", { name: /下一周|Next week/i });
          const more = page.getByRole("button", {
            name: /更多日历操作|More calendar actions/i,
          });
          for (const control of [previous, today, next, more]) {
            const box = await control.boundingBox();
            expect(box?.width).toBeGreaterThanOrEqual(44);
            expect(box?.height).toBeGreaterThanOrEqual(44);
          }

          await more.click();
          const iCalAction = page.getByRole("menuitem", {
            name: /复制日历链接|iCal/i,
          });
          await expect(iCalAction).toBeVisible();
          await iCalAction.click();
          const dialog = page.getByRole("dialog");
          await expect(dialog).toBeVisible();
          await dialog.getByRole("button", { name: /^复制$|^Copy$/i }).click();
          expect(
            await page.evaluate(async () => navigator.clipboard.readText()),
          ).toMatch(/\/api\/calendar-feeds\/[^/]+\.ics$/);

          await page.keyboard.press("Escape");
          await expect(dialog).toBeHidden();

          await next.click();
          await expect(page).toHaveURL(/calendarView=week/);
          await expect(page).toHaveURL(/calendarWeek=\d{4}-\d{2}-\d{2}/);
          await expect(agenda).toBeVisible();
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
          ).toBe(true);

          await page.getByRole("radio", { name: /^(Day|日)$/ }).click();
          await expect(agenda.locator("section")).toHaveCount(1);
          for (const label of [
            /^(Previous day|前一天)$/,
            /^(Today|今天)$/,
            /^(Next day|后一天)$/,
          ]) {
            const box = await page
              .getByRole("button", { name: label })
              .boundingBox();
            expect(box?.width).toBeGreaterThanOrEqual(44);
            expect(box?.height).toBeGreaterThanOrEqual(44);
          }
          await page.getByRole("radio", { name: /^(This week|本周)$/ }).click();
          await expect(agenda.locator("section")).toHaveCount(7);
          await page.setViewportSize({ width: 1280, height: 900 });
          await expect(
            page.getByTestId("workspace-calendar-grid"),
          ).toBeVisible();
          await expect(
            page.getByRole("group", { name: /日历|Calendar/i }),
          ).toBeVisible();
        },
        { accountIndex: 0, calendarTokenCreated: true },
      );
    },
  );
});
