import { describe, expect, it } from "vitest";
import {
  dateTimeInputValue,
  homeworkDueAtSemesterEnd,
  homeworkDueInDays,
  homeworkDueInMonths,
  homeworkSemesterShortcutCapabilities,
  homeworkStartAtSemesterStart,
  homeworkTimestampNow,
  initialHomeworkTimestampDraft,
} from "@/features/homeworks/lib/homework-timestamp-defaults";

describe("homework 时间戳默认值", () => {
  it("构建共享的初始作业时间戳草稿", () => {
    expect(
      initialHomeworkTimestampDraft(new Date("2026-03-16T16:30:00Z")),
    ).toEqual({
      publishedAt: "2026-03-17T00:00",
      submissionStartAt: "2026-03-17T00:30",
      submissionDueAt: "",
    });
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
});

describe("semester shortcut policy across create and edit entrances", () => {
  const now = new Date("2026-11-06T16:30:00Z");
  it.each([
    [null, null, false, false],
    ["2026-02-01", "2026-11-06", true, false],
    ["2026-02-01", "2026-11-07", true, true],
    ["2026-02-01", "2026-11-08", true, true],
  ])(
    "uses Shanghai end-of-day for %s / %s",
    (semesterStart, semesterEnd, hasSemesterStart, hasSemesterEnd) => {
      expect(
        homeworkSemesterShortcutCapabilities({
          semesterStart,
          semesterEnd,
          now,
        }),
      ).toEqual({ hasSemesterStart, hasSemesterEnd });
    },
  );
  it("does not suggest a deadline at the current minute or earlier", () => {
    expect(
      homeworkSemesterShortcutCapabilities({
        semesterEnd: "2026-11-07",
        now: new Date("2026-11-07T15:59:00Z"),
      }),
    ).toEqual({ hasSemesterStart: false, hasSemesterEnd: false });
  });
});
