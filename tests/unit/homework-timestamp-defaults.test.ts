import { describe, expect, it, vi } from "vitest";
import {
  homeworkDueInDays as dashboardHomeworkDueInDays,
  initialCreateHomeworkDraft,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import {
  dateTimeInputValue,
  homeworkDueAtSemesterEnd,
  homeworkDueInDays,
  homeworkDueInMonths,
  homeworkStartAtSemesterStart,
  homeworkTimestampNow,
  initialHomeworkTimestampDraft,
} from "@/features/homeworks/lib/homework-timestamp-defaults";
import {
  initialHomeworkDraft,
  homeworkDueInDays as sectionHomeworkDueInDays,
} from "@/features/section-detail/lib/section-detail-controller-helpers";

describe("homework 时间戳默认值", () => {
  it("构建共享的初始作业时间戳草稿", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-17T02:30:00.000Z"));

    try {
      expect(initialHomeworkTimestampDraft()).toEqual({
        publishedAt: "2026-03-17T00:00",
        submissionStartAt: "2026-03-17T10:30",
        submissionDueAt: "",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("构建共享的作业时间戳快捷方法", () => {
    const now = new Date("2026-03-17T10:30:00+08:00");

    expect(homeworkTimestampNow(now)).toBe("2026-03-17T10:30");
    expect(homeworkDueInDays(7, now)).toBe("2026-03-24T23:59");
    expect(homeworkDueInMonths(1, now)).toBe("2026-04-17T23:59");
    expect(homeworkDueAtSemesterEnd("2026-06-30T08:00:00+08:00")).toBe(
      "2026-06-30T23:59",
    );
    expect(homeworkStartAtSemesterStart("2026-02-23T08:00:00+08:00")).toBe(
      "2026-02-23T00:00",
    );
    expect(dateTimeInputValue("2026-03-17T10:30:00+08:00")).toBe(
      "2026-03-17T10:30",
    );
  });

  it("向 dashboard 和 section detail 暴露相同的时间戳默认值", () => {
    expect(initialCreateHomeworkDraft).toBe(initialHomeworkTimestampDraft);
    expect(initialHomeworkDraft).toBe(initialHomeworkTimestampDraft);
    expect(dashboardHomeworkDueInDays).toBe(homeworkDueInDays);
    expect(sectionHomeworkDueInDays).toBe(homeworkDueInDays);
  });
});
