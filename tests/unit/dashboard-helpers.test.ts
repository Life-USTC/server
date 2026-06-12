import { describe, expect, it } from "vitest";
import {
  buildTimeSlots,
  computeHomeworkBuckets,
} from "@/features/home/server/dashboard-helpers";
import type {
  HomeworkWithSection,
  SessionItem,
} from "@/features/home/server/dashboard-types";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";

function session(startTime: number, endTime: number): SessionItem {
  return {
    id: `${startTime}-${endTime}`,
    sectionJwId: 1,
    courseName: "Course",
    date: new Date("2026-05-22T00:00:00.000Z"),
    startTime,
    endTime,
    location: "Room",
    teacherDisplay: "Teacher",
  };
}

function homework(
  id: string,
  submissionDueAt: string | null,
  completed = false,
): HomeworkWithSection {
  return {
    id,
    title: id,
    publishedAt: null,
    submissionStartAt: null,
    submissionDueAt: submissionDueAt ? new Date(submissionDueAt) : null,
    homeworkCompletions: completed
      ? [{ completedAt: new Date("2026-05-20T00:00:00.000Z") }]
      : [],
    section: null,
  };
}

describe("dashboard helpers", () => {
  it("deduplicates and sorts time slots without reparsing numeric times", () => {
    expect(
      buildTimeSlots([
        session(1000, 1120),
        session(800, 920),
        session(1000, 1120),
      ]),
    ).toEqual([
      { key: "800-920", startTime: 800, endTime: 920 },
      { key: "1000-1120", startTime: 1000, endTime: 1120 },
    ]);
  });

  it("groups incomplete homework by Shanghai due date windows", () => {
    const todayStart = shanghaiDayjs("2026-05-22T00:00:00+08:00");
    const today = homework("today", "2026-05-22T10:00:00+08:00");
    const soon = homework("soon", "2026-05-25T23:59:00+08:00");
    const later = homework("later", "2026-05-26T00:00:00+08:00");
    const unscheduled = homework("unscheduled", null);
    const completed = homework("completed", "2026-05-22T12:00:00+08:00", true);

    const result = computeHomeworkBuckets(
      [today, soon, later, unscheduled, completed],
      todayStart,
    );

    expect(result.incompleteHomeworks).toEqual([
      today,
      soon,
      later,
      unscheduled,
    ]);
    expect(result.dueToday).toEqual([today]);
    expect(result.dueWithin3Days).toEqual([today, soon]);
  });
});
