import { describe, expect, it } from "vitest";
import { buildOverviewStack } from "@/features/workspace/lib/overview-stack";
import type { WorkspaceTimelineItem } from "@/features/workspace/lib/workspace-agenda";

const item = (
  key: string,
  sort: number,
  done = false,
): WorkspaceTimelineItem => ({
  key,
  sort,
  done,
  title: key,
  href: `/destination/${key}`,
  label: "Type",
  detail: "Context",
  meta: "",
  tone: "info",
});

describe("overview stack", () => {
  it("assigns each incomplete item once while keeping overdue dates and chronological order", () => {
    const result = buildOverviewStack({
      todayKey: "2026-09-28",
      currentTime: 1000,
      locale: "en-us",
      focusKey: "session-now",
      overdue: [
        { ...item("todo-overdue", 1500), dateKey: "2026-09-27" },
        { ...item("homework-overdue", 1300), dateKey: "2026-09-26" },
      ],
      days: [
        {
          key: "2026-09-28",
          dateLabel: "Sep 28",
          weekdayLabel: "Monday",
          isToday: true,
          events: [
            item("session-ended", 900),
            item("session-now", 1000),
            item("todo-completed", 1100, true),
            item("todo-today", 1600),
            item("homework-today", 1400),
            item("session-next", 1200),
          ],
        },
        {
          key: "2026-09-29",
          dateLabel: "Sep 29",
          weekdayLabel: "Tuesday",
          isToday: false,
          events: [
            item("exam-next", 900),
            item("todo-next", 1800),
            item("exam-next", 900),
          ],
        },
      ],
    });
    expect(result.urgency.map((event) => event.key)).toEqual([
      "homework-overdue",
      "todo-overdue",
      "homework-today",
      "todo-today",
    ]);
    expect(result.upcoming.map((event) => event.key)).toEqual([
      "session-next",
      "exam-next",
      "todo-next",
    ]);
    expect(result.urgency[0]).toMatchObject({
      dateLabel: "Sep 26",
      weekdayLabel: "Saturday",
      href: "/destination/homework-overdue",
    });
  });
  it("does not repeat the focused deadline and returns empty bands for a completed agenda", () => {
    const result = buildOverviewStack({
      todayKey: "2026-09-28",
      currentTime: 1000,
      locale: "zh-cn",
      focusKey: "todo-today",
      overdue: [],
      days: [
        {
          key: "2026-09-28",
          dateLabel: "9月28日",
          weekdayLabel: "星期一",
          isToday: true,
          events: [item("todo-today", 1200), item("homework-done", 1300, true)],
        },
      ],
    });
    expect(result).toEqual({ urgency: [], upcoming: [] });
  });
});
