import { expect, type Locator, type Page } from "@playwright/test";
import { PLAYWRIGHT_BASE_URL } from "./e2e-db/core";
import { gotoAndWaitForReady } from "./page-ready";
import type {
  createPriorityViewAudit,
  PriorityField,
  VisiblePriorityField,
} from "./property-priority";
import type { WorkspacePriorityFixture } from "./property-priority-workspace-fixture";

type Locale = "zh-cn" | "en-us";
const field = (
  locator: Locator,
  expected: string | RegExp,
): VisiblePriorityField => ({ locator, expected });
const text = (scope: Locator, expected: string | RegExp) =>
  field(scope.getByText(expected).filter({ visible: true }).first(), expected);
const local = (
  item: { nameCn: string; nameEn: string | null },
  locale: Locale,
) => (locale === "en-us" ? (item.nameEn ?? item.nameCn) : item.nameCn);

export async function checkWorkspaceCalendarPriorityViews(
  audit: ReturnType<typeof createPriorityViewAudit>,
  page: Page,
  data: WorkspacePriorityFixture,
  locale: Locale,
  width: number,
) {
  const { catalog, section, schedule, room } = data;
  const main = page.locator("#main-content");
  const courseName = local(catalog.courses[0], locale);
  const teacherName = local(catalog.teachers[0], locale);
  const semester = locale === "en-us" ? "Fall 2026" : "2026年秋季学期";
  const roomName = local(room, locale);
  const dayUrl = `/workspace/calendar?calendarView=day&calendarDay=${data.today}&calendarSemester=${data.semester.id}`;
  await gotoAndWaitForReady(page, dayUrl);
  const agenda = main.getByTestId("calendar-agenda").filter({ visible: true });
  const event = agenda
    .locator(`a[href="/catalog/sections/${section.jwId}"]`)
    .first();
  const identity = event.locator('[data-slot="item-title"]');
  const eventPrimary: Record<string, PriorityField> = {
    "event.title": field(identity, courseName),
    "event.startAt": text(event, "08:00"),
    "event.endAt": text(event, "09:35"),
    "event.type": text(event, locale === "en-us" ? "Courses" : "课程"),
  };
  const eventSecondary = {
    "event.location": text(event, roomName),
    "event.teachers": text(event, teacherName),
  };
  await audit.check({
    feature: "calendar",
    capability: "event-card",
    view: "web",
    scope: event,
    identity,
    primary: eventPrimary,
    secondary: eventSecondary,
    tertiary: { "event.id": { value: `session-${schedule.id}` } },
  });
  await audit.check({
    feature: "calendar",
    capability: "personal-calendar-view",
    view: "web",
    scope: main,
    identity,
    primary: eventPrimary,
    secondary: eventSecondary,
    tertiary: { "event.id": { value: `session-${schedule.id}` } },
  });
  const dayHeading = agenda.locator("h2").first();
  await audit.check({
    feature: "schedule",
    capability: "my-schedule",
    view: "web",
    scope: agenda,
    identity,
    primary: {
      "section.course.namePrimary": field(identity, courseName),
      "schedule.date": field(
        dayHeading,
        new RegExp(String(Number(data.today.slice(8)))),
      ),
      "schedule.startTime": text(event, "08:00"),
      "schedule.endTime": text(event, "09:35"),
    },
    secondary: {
      "schedule.room.namePrimary": text(event, roomName),
      "schedule.teachers.namePrimary": text(event, teacherName),
    },
    tertiary: { "schedule.id": { value: String(schedule.id) } },
  });

  await gotoAndWaitForReady(page, `/catalog/sections/${section.jwId}#calendar`);
  const table = main.getByTestId("section-calendar-table");
  const row = table.getByRole("row").filter({ hasText: "08:00" });
  const date = row.getByRole("cell").nth(1);
  const lecture = row.getByRole("cell").first().locator("div").first();
  await audit.check({
    feature: "calendar",
    capability: "section-calendar-view",
    view: "web",
    scope: row,
    identity: date,
    primary: {
      "event.title": field(lecture, /1/),
      "event.startAt": text(row, "08:00"),
      "event.endAt": text(row, "09:35"),
      "event.type": field(
        lecture,
        locale === "en-us" ? /Lecture|Class/i : /第.*讲|课程|课/,
      ),
    },
    secondary: {
      "event.location": text(row, roomName),
      "event.teachers": text(row, teacherName),
    },
    tertiary: { "event.id": { value: `class-${schedule.id}` } },
  });
  await audit.check({
    feature: "schedule",
    capability: "section-schedule",
    view: "web",
    scope: row,
    identity: date,
    primary: {
      "schedule.date": field(date, data.today),
      "schedule.startTime": text(row, "08:00"),
      "schedule.endTime": text(row, "09:35"),
    },
    secondary: {
      "schedule.room.namePrimary": text(row, roomName),
      "schedule.room.building.namePrimary": text(
        row,
        local(data.building, locale),
      ),
      "schedule.room.building.campus.namePrimary": text(
        row,
        local(data.campus, locale),
      ),
      "schedule.teachers.namePrimary": text(row, teacherName),
    },
    tertiary: {
      "schedule.id": { value: String(schedule.id) },
      "schedule.weekday": { value: String(schedule.weekday), exactText: true },
    },
  });
  await page
    .getByRole("button", { name: /^(添加到日历|Add to calendar)$/i })
    .first()
    .click();
  const calendar = page.getByRole("dialog");
  const calendarTitle = calendar.getByRole("heading").first();
  const calendarUrl = calendar.locator("#calendar-url");
  const publicUrl = `${PLAYWRIGHT_BASE_URL}/api/catalog/sections/${section.jwId}/calendar.ics`;
  const calendarPrimary = {
    "calendar.url": { locator: calendarUrl, expected: publicUrl, input: true },
  };
  await audit.check({
    feature: "ical",
    capability: "section-calendar-dialog",
    view: "web",
    scope: calendar,
    identity: calendarTitle,
    primary: calendarPrimary,
    secondary: {
      "calendar.description": text(
        calendar,
        locale === "en-us"
          ? "Lectures, exams, and homework for this section."
          : /只包含本班级的上课、考试与作业/,
      ),
    },
    tertiary: {},
  });
  await audit.check({
    feature: "section",
    capability: "section-ical",
    view: "web",
    scope: calendar,
    identity: calendarTitle,
    primary: calendarPrimary,
    secondary: {
      "calendar.description": text(
        calendar,
        locale === "en-us"
          ? "Lectures, exams, and homework for this section."
          : "只包含本班级的上课、考试与作业。",
      ),
    },
    tertiary: {},
  });
  await page.keyboard.press("Escape");

  await gotoAndWaitForReady(page, "/workspace/subscriptions");
  const subscriptionRow = main
    .locator(width >= 768 ? "tr" : '[data-slot="item"]')
    .filter({
      has: page.locator(
        `a[data-testid="subscription-course-link"][href="/catalog/sections/${section.jwId}"]`,
      ),
    })
    .filter({ visible: true });
  const subscriptionTitle = subscriptionRow.getByTestId(
    "subscription-course-link",
  );
  const semesterScope = subscriptionRow.locator("xpath=ancestor::section[1]");
  // Inspect the current value before changing this isolated subscription through the real API.
  await subscriptionRow
    .getByRole("button", { name: /订阅身份|Subscription role/ })
    .click();
  const roleDialog = page.getByRole("dialog", {
    name: /订阅身份|Subscription role/,
  });
  const regular = roleDialog.getByRole("radio", { name: /^(普通|Regular)$/ });
  await expect(regular).toBeChecked();
  await audit.check({
    feature: "subscription",
    capability: "update-kind",
    view: "web",
    scope: roleDialog,
    identity: roleDialog.getByRole("heading"),
    primary: {
      "subscription.kind": field(
        regular,
        locale === "en-us" ? "Regular" : "普通",
      ),
    },
    secondary: {
      "section.course.namePrimary": text(roleDialog, courseName),
      "section.code": text(roleDialog, section.code),
    },
    tertiary: {},
  });
  await page.keyboard.press("Escape");
  expect(
    (
      await page.request.patch(`/api/workspace/subscriptions/${section.jwId}`, {
        data: { kind: "teaching_assistant" },
      })
    ).status(),
  ).toBe(200);
  await gotoAndWaitForReady(page, "/workspace/subscriptions");
  await audit.check({
    feature: "subscribed-sections",
    capability: "subscribed-sections-tab",
    view: "web",
    scope: semesterScope,
    identity: subscriptionTitle,
    primary: {
      "section.course.namePrimary": field(subscriptionTitle, courseName),
      "section.teachers.namePrimary": text(subscriptionRow, teacherName),
    },
    secondary: {
      "semester.nameCn": text(semesterScope, semester),
      "section.code": text(subscriptionRow, section.code),
      "section.credits": text(subscriptionRow, "3.5"),
      "subscription.kind": text(
        subscriptionRow,
        locale === "en-us" ? "Teaching assistant" : "助教",
      ),
    },
    tertiary: { "section.id": { value: String(section.id) } },
  });
  await main
    .getByRole("button", { name: /^(复制日历链接|Copy iCal Link)$/i })
    .click();
  const personal = page.getByRole("dialog");
  const personalUrl = personal.locator("#personal-subscription-url");
  const value = `${PLAYWRIGHT_BASE_URL}/api/calendar-feeds/${data.user.id}:${data.user.calendarFeedToken}.ics`;
  await expect(personalUrl).toHaveValue(value);
  await audit.check({
    feature: "ical",
    capability: "personal-calendar-subscription",
    view: "web",
    scope: personal,
    identity: personal.getByRole("heading").first(),
    primary: {
      "calendar.url": { locator: personalUrl, expected: value, input: true },
    },
    secondary: {
      "calendar.description": text(
        personal,
        locale === "en-us"
          ? /Every section you subscribe to/
          : /订阅的所有班级/,
      ),
    },
    tertiary: {},
  });
  await page.keyboard.press("Escape");
  await main
    .getByRole("button", { name: /^(添加订阅|Add subscription)$/i })
    .click();
  const quick = page.getByRole("dialog");
  const quickSemester = quick.locator("#subscriptions-quick-add-semester");
  await quickSemester.selectOption(String(data.semester.id));
  await quick.locator("#subscriptions-quick-add-code").fill(section.code);
  await quick.getByRole("button", { name: /^(搜索|Search)$/ }).click();
  const quickRow = quick
    .locator('[data-slot="item"]')
    .filter({ hasText: courseName });
  await audit.check({
    feature: "subscription",
    capability: "batch-subscribe-by-codes",
    view: "web-quick-add",
    scope: quick,
    identity: quickRow.locator('[data-slot="item-title"]'),
    primary: {
      "section.course.namePrimary": text(quickRow, courseName),
      "section.teachers.namePrimary": text(quickRow, teacherName),
    },
    secondary: {
      "section.code": text(quickRow, section.code),
      "semester.nameCn": field(quickSemester, semester),
      "section.campus.namePrimary": text(quickRow, local(data.campus, locale)),
      "section.isSubscribed": text(quickRow, /已订阅|Subscribed/i),
    },
    tertiary: {},
  });
  await page.keyboard.press("Escape");
  await main
    .getByRole("button", { name: /批量添加订阅|Bulk Add Subscriptions/i })
    .click();
  const bulk = page.getByRole("dialog");
  await bulk
    .locator("#bulk-import-semester")
    .selectOption(String(data.semester.id));
  const unmatched = "999999.99";
  await bulk
    .locator("#bulk-import-section-codes")
    .fill(`${section.code}\n${unmatched}`);
  await bulk.getByRole("button", { name: /匹配|Match/i }).click();
  const confirm = page.getByRole("dialog");
  const match = confirm
    .locator('[data-slot="field"]')
    .filter({ hasText: courseName });
  const matchTitle = match.locator("label");
  await audit.check({
    feature: "subscription",
    capability: "batch-subscribe-by-codes",
    view: "web-import",
    scope: confirm,
    identity: matchTitle,
    primary: { "section.course.namePrimary": field(matchTitle, courseName) },
    secondary: {
      "section.code": text(match, section.code),
      "semester.nameCn": text(match, semester),
      "section.teachers.namePrimary": text(match, teacherName),
      "unmatched.code": text(confirm, unmatched),
    },
    tertiary: {},
  });
  await page.keyboard.press("Escape");
  expect(
    (
      await page.request.patch(`/api/workspace/subscriptions/${section.jwId}`, {
        data: { kind: "regular" },
      })
    ).status(),
  ).toBe(200);
}
