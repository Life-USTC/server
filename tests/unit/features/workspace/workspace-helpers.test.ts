import { describe, expect, it } from "vitest";
import {
  buildTimeSlots,
  computeHomeworkBuckets,
  selectWeeklySessions,
} from "@/features/workspace/server/workspace-helpers";
import { buildWorkspaceOverviewSchedule } from "@/features/workspace/server/workspace-overview-schedule";
import type {
  HomeworkWithSection,
  SessionItem,
} from "@/features/workspace/server/workspace-types";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import { getDefaultWeekRange } from "@/shared/lib/date-utils";

function session(startTime: number, endTime: number): SessionItem {
  return {
    id: `${startTime}-${endTime}`,
    sectionJwId: 1,
    sectionCode: "COURSE.01",
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
    sectionId: 1,
    title: id,
    publishedAt: null,
    submissionStartAt: null,
    submissionDueAt: submissionDueAt ? new Date(submissionDueAt) : null,
    homeworkCompletions: completed
      ? [{ completedAt: new Date("2026-05-20T00:00:00.000Z") }]
      : [],
    completionRequired: true,
    section: null,
  };
}

describe("仪表盘辅助函数", () => {
  it("去重并排序时间段，不重新解析数字时间", () => {
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

  it("按上海截止日期窗口对未完成作业分组", () => {
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
    expect(result.dueWithin3Days).toEqual([soon]);
  });
  it("uses the same Sunday-to-Saturday range for the homepage weekly summary and session membership", () => {
    const referenceNow = shanghaiDayjs("2026-08-31T10:00:00+08:00");
    const summary = buildWorkspaceOverviewSchedule({
      workspaceSections: [],
      homeworks: [],
      locale: "en-us",
      referenceNow,
    });
    expect(summary.weekDays.map((day) => day.format("YYYY-MM-DD"))).toEqual([
      "2026-08-30",
      "2026-08-31",
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
      "2026-09-05",
    ]);
    const sessions = [
      "2026-08-29T23:59:59+08:00",
      "2026-08-30T00:00:00+08:00",
      "2026-09-05T23:59:59+08:00",
      "2026-09-06T00:00:00+08:00",
    ].map((date, index) => ({
      ...session(900, 1000),
      id: String(index),
      date: new Date(date),
    }));
    const { start, endExclusive } = getDefaultWeekRange(referenceNow);
    expect(
      selectWeeklySessions(sessions, start, endExclusive).map(
        (item) => item.id,
      ),
    ).toEqual(["1", "2"]);
  });
});
