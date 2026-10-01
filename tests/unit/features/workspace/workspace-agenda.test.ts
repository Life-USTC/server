import { describe, expect, it } from "vitest";
import {
  buildWorkspaceAgendaDays,
  currentWorkspaceTimedEventKey,
  type WorkspaceTimelineItem,
  workspaceFocusItem,
  workspaceReferenceTime,
} from "@/features/workspace/lib/workspace-agenda";

function item(
  key: string,
  sort: number,
  options: Partial<WorkspaceTimelineItem> = {},
): WorkspaceTimelineItem {
  return {
    href: `/workspace/${key}`,
    key,
    label: "Event",
    meta: "",
    detail: "",
    sort,
    title: key,
    ...options,
  };
}

describe("workspace agenda", () => {
  it("builds a localized seven-day agenda from campus date keys", () => {
    const calendar = {
      events: {
        "2026-07-19": [item("session-1", 800)],
      } as Record<string, WorkspaceTimelineItem[]>,
      todayDate: "2026-07-19",
    };
    const days = buildWorkspaceAgendaDays({
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
      currentWorkspaceTimedEventKey(
        {
          exams: [{ id: "exam", startTime: 1000, endTime: 1200 }],
          sessions: [{ id: 7, startTime: 900, endTime: 1030 }],
        },
        1015,
      ),
    ).toBe("session-7");
    expect(workspaceReferenceTime("2026-07-19T02:15:00.000Z")).toBe(1015);
  });

  it("overview.now-next-first", () => {
    const sourceDays = [
      {
        dateLabel: "Jul 19",
        events: [
          item("session-past", 800),
          item("homework-urgent", 900, {
            meta: "09:00",
            detail: "Submit the problem set.",
          }),
          item("session-now", 1000, {
            meta: "10:00-10:30",
            detail: "Room 101 · Teacher A",
          }),
          item("todo-done", 1030, { done: true }),
          item("session-next", 1100, {
            meta: "11:00-12:00",
            detail: "Room 202 · Teacher B",
          }),
        ],
        isToday: true,
        key: "2026-07-19",
        weekdayLabel: "Sunday",
      },
      {
        dateLabel: "Jul 20",
        events: [
          item("exam-tomorrow", 900, {
            meta: "09:00-10:00",
            detail: "Written · A101(30)",
          }),
        ],
        isToday: false,
        key: "2026-07-20",
        weekdayLabel: "Monday",
      },
    ];

    const days = buildWorkspaceAgendaDays({
      calendar: { todayDate: "2026-07-19" },
      eventsForDay: (_calendar, dayKey) =>
        sourceDays.find((day) => day.key === dayKey)?.events ?? [],
      locale: "en-US",
      startKey: "2026-07-19",
      timelineItemsForDay: (events) => events,
    });
    expect(days).toHaveLength(7);
    expect(days.at(-1)?.key).toBe("2026-07-25");
    expect(
      workspaceFocusItem({
        currentEventKey: "session-now",
        currentTime: 1015,
        days,
        todayKey: "2026-07-19",
      }),
    ).toMatchObject({
      key: "session-now",
      status: "now",
      time: "10:00-10:30",
      detail: "Room 101 · Teacher A",
    });
    expect(
      workspaceFocusItem({
        currentTime: 1015,
        days,
        todayKey: "2026-07-19",
      }),
    ).toMatchObject({
      key: "homework-urgent",
      status: "urgent",
      time: "09:00",
      detail: "Submit the problem set.",
    });

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
      workspaceFocusItem({
        currentTime: 1015,
        days: withoutUrgent,
        todayKey: "2026-07-19",
      }),
    ).toMatchObject({
      key: "session-next",
      status: "next",
      time: "11:00-12:00",
      detail: "Room 202 · Teacher B",
    });
    expect(
      workspaceFocusItem({
        currentTime: 2300,
        days: days.map((day) => (day.isToday ? { ...day, events: [] } : day)),
        todayKey: "2026-07-19",
      }),
    ).toMatchObject({
      key: "exam-tomorrow",
      status: "next",
      time: "09:00-10:00",
      detail: "Written · A101(30)",
    });
    expect(
      workspaceFocusItem({
        currentTime: 1015,
        days: days.map((day) => ({
          ...day,
          events: day.events.map((event) => ({ ...event, done: true })),
        })),
        todayKey: "2026-07-19",
      }),
    ).toBeNull();
  });

  it("preserves activity context and missing time without promoting the sort sentinel", () => {
    for (const [sort, meta, expectedTime] of [
      [1800, "18:00-19:00", "18:00-19:00"],
      [2400, "", ""],
    ] as const) {
      const focus = workspaceFocusItem({
        currentTime: 1700,
        days: [
          {
            dateLabel: "Jul 19",
            events: [
              item("activity-evening", sort, {
                meta,
                detail: "East campus hall",
              }),
            ],
            isToday: true,
            key: "2026-07-19",
            weekdayLabel: "Sunday",
          },
        ],
        todayKey: "2026-07-19",
      });
      expect(focus).toEqual({
        href: "/workspace/activity-evening",
        key: "activity-evening",
        label: "Event",
        sort,
        title: "activity-evening",
        detail: "East campus hall",
        time: expectedTime,
        dateKey: "2026-07-19",
        dateLabel: "Jul 19",
        status: "next",
        weekdayLabel: "Sunday",
      });
    }
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
      workspaceFocusItem({
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
      workspaceFocusItem({
        currentTime: 2300,
        days: [{ ...future, events: [{ ...futureExam, done: true }] }],
        todayKey: "2026-07-19",
      }),
    ).toBeNull();
  });
});
