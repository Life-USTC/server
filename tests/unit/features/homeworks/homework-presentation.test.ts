import { describe, expect, it } from "vitest";
import {
  formatHomeworkDetailDateTime,
  formatHomeworkDueRelativeTime,
  homeworkDeadlineState,
  homeworkSummaryBadges,
  normalizeHomeworkDetail,
} from "@/features/homeworks/lib/homework-presentation";

const referenceDate = "2026-05-22T10:30:00+08:00";

describe("homework detail presentation", () => {
  it("normalizes dashboard and section-shaped descriptions into one model", () => {
    expect(
      normalizeHomeworkDetail(
        {
          completion: { completedAt: referenceDate },
          description: {
            content: "- 题目：完成报告",
            renderedHtml: "<p>完成报告</p>",
          },
          id: 42,
          isMajor: true,
          publishedAt: "2026-05-01T09:00:00+08:00",
          requiresTeam: true,
          section: { code: "CS101" },
          submissionDueAt: "2026-05-29T23:59:00+08:00",
          submissionStartAt: "2026-05-02T00:00:00+08:00",
          title: "第一次作业",
        },
        { contextHref: "/sections/1", contextLabel: "程序设计 · CS101" },
      ),
    ).toEqual({
      completed: true,
      contextHref: "/sections/1",
      contextLabel: "程序设计 · CS101",
      description: "- 题目：完成报告",
      renderedDescriptionHtml: "<p>完成报告</p>",
      id: "42",
      isMajor: true,
      publishedAt: "2026-05-01T09:00:00+08:00",
      requiresTeam: true,
      submissionDueAt: "2026-05-29T23:59:00+08:00",
      submissionStartAt: "2026-05-02T00:00:00+08:00",
      title: "第一次作业",
    });
  });

  it("shows a numeric duration for both upcoming and overdue deadlines", () => {
    expect(
      formatHomeworkDueRelativeTime(
        "2026-05-22T10:31:00+08:00",
        referenceDate,
        "zh-cn",
        "待定",
      ),
    ).toBe("还剩 1分钟");
    expect(
      formatHomeworkDueRelativeTime(
        "2026-05-21T23:59:00+08:00",
        referenceDate,
        "en-us",
        "TBD",
      ),
    ).toBe("Overdue by 11 hours");
    expect(
      formatHomeworkDueRelativeTime(null, referenceDate, "zh-cn", "待定"),
    ).toBe("待定");
  });

  it("formats detail deadlines consistently in the campus timezone", () => {
    expect(
      formatHomeworkDetailDateTime(
        "2026-05-03T23:00:00+08:00",
        "zh-cn",
        "待定",
      ),
    ).toBe("2026/5/3 23:00");
    expect(formatHomeworkDetailDateTime(null, "zh-cn", "待定")).toBe("待定");
  });

  it("derives deadline state and shared badge semantics", () => {
    expect(
      homeworkDeadlineState("2026-05-22T10:31:00+08:00", referenceDate),
    ).toBe("upcoming");
    expect(
      homeworkDeadlineState("2026-05-22T10:30:00+08:00", referenceDate),
    ).toBe("overdue");
    expect(homeworkDeadlineState(null, referenceDate)).toBe("unset");
    expect(
      homeworkSummaryBadges(
        { completed: true, isMajor: true, requiresTeam: true },
        { completed: "已完成", major: "大作业", team: "需要组队" },
      ),
    ).toEqual([
      { key: "completed", label: "已完成", variant: "secondary" },
      { key: "major", label: "大作业", variant: "outline" },
      { key: "team", label: "需要组队", variant: "outline" },
    ]);
  });
});
