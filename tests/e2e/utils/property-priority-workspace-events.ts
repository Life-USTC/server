import { expect, type Locator, type Page } from "@playwright/test";
import { gotoAndWaitForReady } from "./page-ready";
import type {
  createPriorityViewAudit,
  PriorityField,
} from "./property-priority";
import type { WorkspacePriorityFixture } from "./property-priority-workspace-fixture";

type Locale = "zh-cn" | "en-us";
type Kind = "class" | "exam" | "homework" | "todo" | "activity";
const local = (
  item: { nameCn: string; nameEn: string | null },
  locale: Locale,
) => (locale === "en-us" ? (item.nameEn ?? item.nameCn) : item.nameCn);
const field = (locator: Locator, expected: string | RegExp): PriorityField => ({
  locator,
  expected,
});
const text = (scope: Locator, expected: string | RegExp) =>
  field(scope.getByText(expected).filter({ visible: true }).first(), expected);

function calendarUrl(
  data: WorkspacePriorityFixture,
  mode: string,
  date: string,
) {
  return `/workspace/calendar?calendarView=${mode}&calendarDay=${date}&calendarWeek=${date}&calendarMonth=${date.slice(0, 7)}&calendarSemester=${data.semester.id}`;
}

async function checkEvent(
  audit: ReturnType<typeof createPriorityViewAudit>,
  page: Page,
  data: WorkspacePriorityFixture,
  locale: Locale,
  kind: Kind,
  layout: "agenda" | "desktop-grid",
) {
  const grid = layout === "desktop-grid";
  const scope = page
    .getByTestId(grid ? "workspace-calendar-grid" : "calendar-agenda")
    .filter({ visible: true });
  const courseName = local(data.catalog.courses[0], locale);
  const title =
    kind === "activity"
      ? data.activity.name
      : kind === "todo"
        ? data.todo.title
        : kind === "homework"
          ? data.homework.title
          : courseName;
  const href =
    kind === "activity"
      ? `/catalog/young-events/${data.activity.youngId}`
      : kind === "class"
        ? `/catalog/sections/${data.section.jwId}`
        : kind === "exam"
          ? "/workspace/exams"
          : kind === "todo"
            ? "/workspace/todos"
            : undefined;
  const event = (
    href ? scope.locator(`a[href="${href}"]`) : scope.getByRole("link")
  )
    .filter({ hasText: title })
    .first();
  const identity = event.locator('[data-slot="item-title"]');
  const primary: Record<string, PriorityField> = {
    "event.title": field(identity, title),
  };
  if (kind === "activity") {
    primary["event.startAt"] = text(event, "17:00");
    primary["event.endAt"] = text(event, "18:00");
  } else if (kind === "class" || kind === "exam") {
    primary["event.startAt"] = text(
      event,
      kind === "class" ? "08:00" : "14:00",
    );
    primary["event.endAt"] = text(event, kind === "class" ? "09:35" : "16:00");
  } else
    primary["event.dueAt"] = text(
      event,
      kind === "homework" ? "12:30" : "11:45",
    );
  if (!grid && kind !== "activity")
    primary["event.type"] = field(
      event.locator('[data-slot="item-description"]'),
      {
        class: locale === "en-us" ? "Courses" : "课程",
        exam: locale === "en-us" ? "Exam" : "考试",
        homework: locale === "en-us" ? "Homework" : "作业",
        todo: locale === "en-us" ? "To-do" : "待办",
      }[kind],
    );
  let secondary: Record<string, PriorityField>;
  if (kind === "class") {
    let teachers = event;
    if (grid) {
      await event.hover();
      teachers = page.locator('[data-slot="tooltip-content"]');
      await expect(teachers).toBeVisible();
      // The hover actually reveals the full location, not only the clipped room.
      await expect(teachers).toContainText(local(data.building, locale));
      await expect(teachers).toContainText(local(data.campus, locale));
    }
    secondary = {
      "event.location": text(event, local(data.room, locale)),
      "event.teachers": text(teachers, local(data.catalog.teachers[0], locale)),
    };
  } else if (kind === "activity")
    secondary = { "event.location": text(event, data.activity.location ?? "") };
  else if (kind === "exam")
    secondary = {
      "event.mode": text(event, data.exam.examMode ?? ""),
      "event.location": text(event, `ExamRoom-${data.catalog.marker}`),
    };
  else if (kind === "homework")
    secondary = {
      "event.description": text(event, `Instructions ${data.catalog.marker}`),
    };
  else
    secondary = {
      "event.priority": text(event, locale === "en-us" ? "High" : "高"),
      "event.content": text(event, data.todo.content ?? ""),
    };
  const id =
    kind === "activity"
      ? `young-${data.activity.youngId}`
      : kind === "class"
        ? `session-${data.schedule.id}`
        : `${kind}-${data[kind].id}`;
  await audit.check({
    feature: "calendar",
    capability: "event-card",
    view: `web-${layout}-${kind}`,
    scope: event,
    identity,
    primary,
    secondary,
    tertiary: { "event.id": { value: id } },
  });
  if (kind === "class") {
    await audit.check({
      feature: "calendar",
      capability: "personal-calendar-view",
      view: `web-${layout}`,
      scope,
      identity,
      primary,
      secondary,
      tertiary: { "event.id": { value: id } },
    });
    const day = grid
      ? event.locator('xpath=ancestor::*[@role="gridcell"][1]')
      : event.locator("xpath=ancestor::section[1]");
    const date = grid
      ? day.locator("div").first().locator("div").first()
      : day.getByRole("heading");
    await audit.check({
      feature: "schedule",
      capability: "my-schedule",
      view: `web-${layout}`,
      scope: day,
      identity,
      primary: {
        "section.course.namePrimary": field(identity, title),
        "schedule.date": field(
          date,
          grid
            ? data.today.slice(5)
            : new RegExp(String(Number(data.today.slice(8)))),
        ),
        "schedule.startTime": text(event, "08:00"),
        "schedule.endTime": text(event, "09:35"),
      },
      secondary: {
        "schedule.room.namePrimary": secondary["event.location"],
        "schedule.teachers.namePrimary": secondary["event.teachers"],
      },
      tertiary: { "schedule.id": { value: String(data.schedule.id) } },
    });
    if (grid) await page.keyboard.press("Escape");
  }
}

/** Distinct event payloads and the real responsive layouts; no hidden grid counts as mobile evidence. */
export async function checkWorkspaceEventPriorityViews(
  audit: ReturnType<typeof createPriorityViewAudit>,
  page: Page,
  data: WorkspacePriorityFixture,
  locale: Locale,
  width: number,
) {
  const activityLink = (layout: "agenda" | "desktop-grid") =>
    page
      .getByTestId(
        layout === "agenda" ? "calendar-agenda" : "workspace-calendar-grid",
      )
      .filter({ visible: true })
      .locator(`a[href="/catalog/young-events/${data.activity.youngId}"]`);
  await gotoAndWaitForReady(page, calendarUrl(data, "day", data.today));
  await expect(activityLink("agenda")).toBeVisible();
  for (const kind of ["class", "homework", "todo", "activity"] as const)
    await checkEvent(audit, page, data, locale, kind, "agenda");
  await gotoAndWaitForReady(page, calendarUrl(data, "day", data.tomorrow));
  await checkEvent(audit, page, data, locale, "exam", "agenda");
  for (const mode of ["week", "month", "semester"]) {
    await gotoAndWaitForReady(page, calendarUrl(data, mode, data.today));
    const grid = page.getByTestId("workspace-calendar-grid");
    if (width < 768) await expect(grid).toBeHidden();
    else await expect(grid).toBeVisible();
    const layout = width < 768 ? "agenda" : "desktop-grid";
    // The real activity read rebuilds the event collection; wait for its result
    // before hovering a class so the initial async render cannot replace it.
    await expect(activityLink(layout)).toBeVisible();
    for (const kind of ["class", "homework", "todo", "activity"] as const)
      await checkEvent(audit, page, data, locale, kind, layout);
    await gotoAndWaitForReady(page, calendarUrl(data, mode, data.tomorrow));
    await checkEvent(audit, page, data, locale, "exam", layout);
  }
}
