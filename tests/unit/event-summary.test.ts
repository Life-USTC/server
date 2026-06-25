import { describe, expect, it } from "vitest";
import type { listUserCalendarEvents } from "@/features/calendar/server/calendar-events";
import {
  summarizeBusDeparture,
  summarizeCalendarEventCollection,
} from "@/lib/mcp/tools/event-summary";

describe("summarizeCalendarEventCollection", () => {
  it("groups events by day and type while trimming nested payloads", () => {
    const events = [
      {
        type: "schedule" as const,
        at: "2026-04-29T08:30:00+08:00",
        payload: {
          id: 1,
          date: "2026-04-29T08:00:00+08:00",
          weekday: 2,
          startTime: 830,
          endTime: 1015,
          weekIndex: 1,
          section: {
            id: 10,
            jwId: 9902001,
            code: "DEV-CS201.01",
            course: {
              jwId: 9901001,
              code: "DEV-CS201",
              namePrimary: "软件工程实践",
            },
          },
          room: {
            id: 1,
            namePrimary: "DEV 测试教室 101",
          },
          teachers: [{ id: 1, namePrimary: "王测试" }],
        },
      },
      {
        type: "homework_due" as const,
        at: "2026-04-29T23:00:00+08:00",
        payload: {
          id: "hw-1",
          sectionId: 10,
          title: "迭代一需求拆解",
          submissionDueAt: "2026-04-29T23:00:00+08:00",
          commentCount: 1,
          section: {
            id: 10,
            jwId: 9902001,
            code: "DEV-CS201.01",
            course: {
              jwId: 9901001,
              code: "DEV-CS201",
              namePrimary: "软件工程实践",
            },
          },
          description: { content: "trim me" },
        },
      },
      {
        type: "todo_due" as const,
        at: "2026-04-30T09:00:00+08:00",
        payload: {
          id: "todo-1",
          title: "今天提交报告",
          priority: "high",
          dueAt: "2026-04-30T09:00:00+08:00",
          completed: false,
          content: "trim me",
        },
      },
    ] as unknown as Awaited<ReturnType<typeof listUserCalendarEvents>>;

    const summary = summarizeCalendarEventCollection(events, {
      itemLimit: 2,
      dayLimit: 2,
    });

    expect(summary.total).toBe(3);
    expect(summary.byType.schedule).toBe(1);
    expect(summary.byType.homework_due).toBe(1);
    expect(summary.byType.todo_due).toBe(1);
    expect(summary.items).toHaveLength(2);
    expect(summary.days).toHaveLength(2);
    expect(summary.days[0]?.date).toBe("2026-04-29");
    expect(
      (
        summary.items[1] as {
          payload?: { description?: unknown; section?: { code?: string } };
        }
      ).payload?.description,
    ).toBeUndefined();
    expect(
      (
        summary.items[1] as {
          payload?: { section?: { code?: string } };
        }
      ).payload?.section?.code,
    ).toBe("DEV-CS201.01");
  });
});

describe("summarizeBusDeparture", () => {
  it("drops repeated campus payloads from departure summaries", () => {
    const summary = summarizeBusDeparture({
      tripId: 1,
      routeId: 8,
      departureTime: "21:20",
      arrivalTime: "22:00",
      minutesUntilDeparture: 12,
      status: "upcoming",
      route: {
        id: 8,
        nameCn: "东区 -> 高新",
        descriptionPrimary: "东区 -> 西区 -> 先研院 -> 高新",
      },
      originCampus: { id: 1, nameCn: "东区" },
      destinationCampus: { id: 6, nameCn: "高新" },
    });

    expect(summary).toMatchObject({
      routeId: 8,
      departureTime: "21:20",
      route: {
        id: 8,
        nameCn: "东区 -> 高新",
      },
    });
    expect(summary).not.toHaveProperty("originCampus");
    expect(summary).not.toHaveProperty("destinationCampus");
  });
});
