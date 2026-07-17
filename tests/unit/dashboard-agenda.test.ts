import { describe, expect, it } from "vitest";
import {
  buildDashboardAgendaDays,
  currentDashboardTimedEventKey,
  type DashboardTimelineItem,
  dashboardFocusItem,
  dashboardReferenceTime,
} from "@/features/dashboard/lib/dashboard-agenda";

function item(
  key: string,
  sort: number,
  options: Partial<DashboardTimelineItem> = {},
): DashboardTimelineItem {
  return {
    href: `/dashboard/${key}`,
    key,
    label: "Event",
    sort,
    title: key,
    ...options,
  };
}

describe("dashboard agenda", () => {
  it("builds a localized seven-day agenda from campus date keys", () => {
    const calendar = {
      events: {
        "2026-07-19": [item("session-1", 800)],
      } as Record<string, DashboardTimelineItem[]>,
      todayDate: "2026-07-19",
    };
    const days = buildDashboardAgendaDays({
      calendar,
      eventsForDay: (value, key) => value.events[key] ?? [],
      locale: "en-US",
      startKey: "2026-07-19",
      timelineItemsForDay: (events) => events,
    });

    expect(days).toHaveLength(7);
    expect(days[0]).toMatchObject({
      dateLabel: "Jul 19",
      isToday: true,
      key: "2026-07-19",
      weekdayLabel: "Sunday",
    });
    expect(days[0]?.events[0]?.key).toBe("session-1");
    expect(days[6]?.key).toBe("2026-07-25");
  });

  it("identifies a current timed event and Shanghai reference time", () => {
    expect(
      currentDashboardTimedEventKey(
        {
          exams: [{ id: "exam", startTime: 1000, endTime: 1200 }],
          sessions: [{ id: 7, startTime: 900, endTime: 1030 }],
        },
        1015,
      ),
    ).toBe("session-7");
    expect(dashboardReferenceTime("2026-07-19T02:15:00.000Z")).toBe(1015);
  });

  it("prioritizes now, then overdue work, then the next incomplete item", () => {
    const days = [
      {
        dateLabel: "Jul 19",
        events: [
          item("session-past", 800),
          item("homework-urgent", 900),
          item("session-now", 1000),
          item("todo-done", 1030, { done: true }),
          item("session-next", 1100),
        ],
        isToday: true,
        key: "2026-07-19",
        weekdayLabel: "Sunday",
      },
      {
        dateLabel: "Jul 20",
        events: [item("exam-tomorrow", 900)],
        isToday: false,
        key: "2026-07-20",
        weekdayLabel: "Monday",
      },
    ];

    expect(
      dashboardFocusItem({
        currentEventKey: "session-now",
        currentTime: 1015,
        days,
        todayKey: "2026-07-19",
      }),
    ).toMatchObject({ key: "session-now", status: "now" });
    expect(
      dashboardFocusItem({
        currentTime: 1015,
        days,
        todayKey: "2026-07-19",
      }),
    ).toMatchObject({ key: "homework-urgent", status: "urgent" });

    const withoutUrgent = [
      {
        ...days[0],
        events:
          days[0]?.events.filter((event) => event.key !== "homework-urgent") ??
          [],
      },
      days[1],
    ];
    expect(
      dashboardFocusItem({
        currentTime: 1015,
        days: withoutUrgent,
        todayKey: "2026-07-19",
      }),
    ).toMatchObject({ key: "session-next", status: "next" });
  });

  it("falls back to a future day and returns null when nothing is actionable", () => {
    const futureExam = item("exam-tomorrow", 900);
    const future = {
      dateLabel: "Jul 20",
      events: [futureExam],
      isToday: false,
      key: "2026-07-20",
      weekdayLabel: "Monday",
    };

    expect(
      dashboardFocusItem({
        currentTime: 2300,
        days: [
          {
            ...future,
            events: [],
            isToday: true,
            key: "2026-07-19",
          },
          future,
        ],
        todayKey: "2026-07-19",
      }),
    ).toMatchObject({ key: "exam-tomorrow", status: "next" });
    expect(
      dashboardFocusItem({
        currentTime: 2300,
        days: [{ ...future, events: [{ ...futureExam, done: true }] }],
        todayKey: "2026-07-19",
      }),
    ).toBeNull();
  });
});
