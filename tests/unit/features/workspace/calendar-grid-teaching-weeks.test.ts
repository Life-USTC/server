import { describe, expect, it } from "vitest";
import { mapWorkspaceScheduleRow } from "@/features/subscriptions/server/subscription-workspace-section-mapping";
import {
  addDays,
  monthWeeks,
} from "@/features/workspace/lib/calendar-date-keys";
import { buildWorkspaceCalendarGridWeeks } from "@/features/workspace/lib/calendar-grid";
import { buildSessions } from "@/features/workspace/server/workspace-section-helpers";

type Session = {
  courseName: string;
  dateKey: string;
  weekIndex?: number | null;
};
function grid(view: string, sessions: Session[]) {
  const week = Array.from({ length: 7 }, (_, day) =>
    addDays("2026-11-02", day),
  );
  return buildWorkspaceCalendarGridWeeks({
    addDays,
    calendar: { semesterWeeks: [week], todayDate: "2026-11-06" },
    calendarEventParts: (parts) => parts.join(" · "),
    calendarEventsForDay: (_calendar, key) => ({
      sessions: sessions.filter((s) => s.dateKey === key),
      exams: [],
      homeworks: [],
      todos: [],
    }),
    calendarExamChipFields: () => ({ detail: "", meta: "" }),
    calendarHomeworkChipFields: () => ({ detail: "", meta: "" }),
    calendarHomeworkHref: () => "#homework",
    calendarSessionChipFields: () => ({ detail: "", meta: "" }),
    calendarTodoChipFields: () => ({ detail: "", meta: "" }),
    calendarWeekLabel: (index) => `Week #${index + 1}`,
    workspaceTabHref: (tab) => `/workspace/${tab}`,
    examLabel: "Exam",
    month: "2026-11",
    monthWeeks,
    sectionWeekLabel: "Week",
    sessionHref: () => "/catalog/sections/178547",
    view,
    weekStart: "2026-11-02",
  });
}
function containingDate(view: string, sessions: Session[]) {
  return grid(view, sessions).find((week) =>
    week.days.some((day) => day.key === "2026-11-06"),
  );
}
describe("stored teaching week labels", () => {
  it("keeps the same stored week across month, semester and week grids", () => {
    for (const view of ["month", "semester", "week"]) {
      const week = containingDate(view, [
        { courseName: "Computer Vision", dateKey: "2026-11-06", weekIndex: 10 },
      ]);
      expect(week?.label).toBe("Week #10");
      expect(
        week?.days.find((day) => day.key === "2026-11-06")?.events[0].href,
      ).toBe("/catalog/sections/178547");
    }
  });
  it("does not invent a row number when schedules have conflicting or unknown teaching weeks", () => {
    for (const indices of [
      [],
      [undefined],
      [null],
      [10, undefined],
      [10, 11],
      [0],
      [-1],
      [1.5],
    ]) {
      const sessions = indices.map((weekIndex) => ({
        courseName: "Adjusted class",
        dateKey: "2026-11-06",
        weekIndex,
      }));
      expect(containingDate("month", sessions)?.label).toBe("Week");
    }
    expect(
      containingDate("month", [
        { courseName: "First class", dateKey: "2026-11-06", weekIndex: 1 },
      ])?.label,
    ).toBe("Week #1");
  });
});

it("preserves the stored teaching week from the workspace row into its session", () => {
  const schedule = mapWorkspaceScheduleRow({
    id: 1,
    date: new Date("2026-11-06T01:45:00Z"),
    weekIndex: 10,
    startTime: 945,
    endTime: 1210,
    customPlace: "GH-206",
    room: null,
    teachers: [],
  });
  const [session] = buildSessions([
    {
      id: 1,
      jwId: 178547,
      code: "210710.01",
      course: { namePrimary: "Computer Vision" },
      semester: { id: 1 },
      schedules: [schedule],
      exams: [],
    },
  ]);
  expect(session.weekIndex).toBe(10);
  expect(session.sectionJwId).toBe(178547);
});
