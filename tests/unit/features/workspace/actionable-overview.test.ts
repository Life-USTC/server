import { describe, expect, it } from "vitest";
import type { PersonalCalendarItem } from "@/features/calendar/server/personal-calendar-item";
import { buildActionableOverviewProjection } from "@/features/workspace/server/actionable-overview-projection";

const atTime = new Date("2035-09-15T10:30:00+08:00");
const at = (day: number, time = "12:00:00") => `2035-09-${day}T${time}+08:00`;
function item(
  type: PersonalCalendarItem["type"],
  id: string,
  time: string | null,
  end: string | null = null,
): PersonalCalendarItem {
  const kind =
    type === "schedule"
      ? "section"
      : type === "homework_due"
        ? "homework"
        : type === "todo_due"
          ? "todo"
          : type;
  return {
    id: `${kind === "section" ? "schedule" : kind}-${id}`,
    type,
    at: time,
    endsAt: end,
    title: id,
    location: null,
    url: "/target",
    youngId: null,
    target: { kind, id },
    sectionJwId: null,
    sectionCode: null,
    teachers: [],
    subscriptionKind: null,
    priority: null,
    content: null,
    examMode: null,
    hasTime: time !== null,
    completionRequired: null,
    conflictIntervals: [],
  };
}
function project(
  events: PersonalCalendarItem[],
  pendingDeadlines: PersonalCalendarItem[] = [],
) {
  return buildActionableOverviewProjection({
    atTime,
    locale: "en-us",
    events,
    pendingDeadlines,
  });
}
const ids = (rows: PersonalCalendarItem[]) => rows.map(({ title }) => title);

describe("actionable overview projection", () => {
  it("shares current, urgent and next focus ordering across all five calendar kinds", () => {
    const schedule = item(
      "schedule",
      "class",
      at(15, "10:00:00"),
      at(15, "11:00:00"),
    );
    const activity = item("young_event", "workshop", at(14), at(16));
    const homework = item("homework_due", "exercise", at(15, "09:00:00"));
    const todo = item("todo_due", "read", at(15, "13:00:00"));
    const exam = item("exam", "exam", at(16, "09:00:00"), at(16, "11:00:00"));
    const full = project([schedule, activity, exam], [homework, todo]);
    expect(full.focus).toMatchObject({ title: "class", status: "now" });
    expect(ids(full.urgency)).toEqual(["exercise", "read"]);
    expect(ids(full.upcoming)).toEqual(["workshop", "exam"]);
    expect(project([activity, exam], [homework, todo]).focus).toMatchObject({
      title: "workshop",
      status: "now",
    });
    expect(project([exam], [homework, todo]).focus).toMatchObject({
      title: "exercise",
      status: "urgent",
    });
    expect(project([exam], [todo]).focus).toMatchObject({
      title: "read",
      status: "next",
    });
    expect(project([exam]).focus).toMatchObject({
      title: "exam",
      status: "next",
    });
    expect(project([]).focus).toBeNull();
  });

  it("keeps all pending deadlines, separates Shanghai buckets and excludes focus from the stack", () => {
    const pending = [
      item("todo_due", "undated", null),
      item("todo_due", "fourth", at(19, "00:00:00")),
      item("homework_due", "third-end", at(18, "23:59:59")),
      item("todo_due", "tomorrow", at(16, "00:00:00")),
      item("homework_due", "today-end", at(15, "23:59:59")),
      item("todo_due", "today-start", at(15, "00:00:00")),
      item("homework_due", "overdue", at(14, "23:59:59")),
    ];
    const result = project([], pending);
    expect(result.focus).toMatchObject({
      title: "today-start",
      status: "urgent",
    });
    expect(ids(result.urgency)).toEqual(["overdue", "today-end"]);
    expect(ids(result.deadlines.today)).toEqual(["today-start", "today-end"]);
    expect(ids(result.deadlines.nextThreeDays)).toEqual([
      "tomorrow",
      "third-end",
    ]);
    expect(ids(result.deadlines.allPending)).toEqual([
      "overdue",
      "today-start",
      "today-end",
      "tomorrow",
      "third-end",
      "fourth",
      "undated",
    ]);
  });

  it("uses shared title ordering for simultaneous next actions before activities", () => {
    const schedule = item(
      "schedule",
      "A class",
      at(15, "12:00:00"),
      at(15, "13:00:00"),
    );
    const exam = item("exam", "B exam", at(15, "12:00:00"), at(15, "13:00:00"));
    const activity = item(
      "young_event",
      "Earlier alphabetic activity",
      at(15, "12:00:00"),
      at(15, "13:00:00"),
    );
    expect(project([activity, exam, schedule]).focus?.title).toBe("A class");
  });

  it("retains unknown-time exams and bounds focus to seven Shanghai days", () => {
    const unknown = {
      ...item("exam", "unknown-time", at(15, "00:00:00")),
      hasTime: false,
    };
    expect(project([unknown]).focus).toMatchObject({
      title: "unknown-time",
      status: "next",
      hasTime: false,
    });
    expect(project([item("exam", "seventh", at(21))]).focus?.title).toBe(
      "seventh",
    );
    expect(project([item("exam", "eighth", at(22))]).focus).toBeNull();
  });
});
