import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { loadCalendarEventSourcesMock } = vi.hoisted(() => ({
  loadCalendarEventSourcesMock: vi.fn(),
}));

vi.mock("@/features/calendar/server/calendar-event-sources", () => ({
  loadCalendarEventSources: loadCalendarEventSourcesMock,
}));

import {
  mapExamCalendarEvent,
  mapHomeworkCalendarEvent,
  mapScheduleCalendarEvent,
  mapTodoCalendarEvent,
} from "@/features/calendar/server/calendar-event-mappers";
import {
  isWithinExactWindow,
  resolveCalendarEventWindow,
} from "@/features/calendar/server/calendar-event-window";
import { listUserCalendarEvents } from "@/features/calendar/server/calendar-events";

function shanghaiDate(iso: string) {
  return new Date(iso);
}

describe("日历事件窗口解析", () => {
  it("无参数时使用当天上海午夜并默认覆盖 7 天", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-21T16:00:00.000Z"));

    try {
      const window = resolveCalendarEventWindow({
        dateFromIsDateOnly: false,
        dateToInclusive: false,
        dateToIsDateOnly: false,
      });

      expect(window.windowStart.toISOString()).toBe("2026-05-21T16:00:00.000Z");
      expect(window.windowEnd.toISOString()).toBe("2026-05-28T16:00:00.000Z");
      expect(window.calendarDateStart.toISOString()).toBe(
        "2026-05-21T16:00:00.000Z",
      );
      expect(window.calendarDateEnd.toISOString()).toBe(
        "2026-05-29T16:00:00.000Z",
      );
      expect(window.includeWindowEnd).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("dateFrom 仅日期时归到该上海日开始", () => {
    const window = resolveCalendarEventWindow({
      dateFrom: shanghaiDate("2026-05-22"),
      dateFromIsDateOnly: true,
      dateToInclusive: false,
      dateToIsDateOnly: false,
    });

    expect(window.windowStart.toISOString()).toBe("2026-05-21T16:00:00.000Z");
    expect(window.calendarDateStart.toISOString()).toBe(
      "2026-05-21T16:00:00.000Z",
    );
    expect(window.windowEnd.toISOString()).toBe("2026-05-28T16:00:00.000Z");
    expect(window.includeWindowEnd).toBe(false);
  });

  it("dateFrom 含时间时保留时间但 calendarDateStart 仍归到日开始", () => {
    const window = resolveCalendarEventWindow({
      dateFrom: shanghaiDate("2026-05-22T10:30:00+08:00"),
      dateFromIsDateOnly: false,
      dateToInclusive: false,
      dateToIsDateOnly: false,
    });

    expect(window.windowStart.toISOString()).toBe("2026-05-22T02:30:00.000Z");
    expect(window.calendarDateStart.toISOString()).toBe(
      "2026-05-21T16:00:00.000Z",
    );
  });

  it("dateTo 仅日期时延伸到次日零点的日历窗口", () => {
    const window = resolveCalendarEventWindow({
      dateFrom: shanghaiDate("2026-05-22"),
      dateFromIsDateOnly: true,
      dateTo: shanghaiDate("2026-05-25"),
      dateToInclusive: false,
      dateToIsDateOnly: true,
    });

    expect(window.windowEnd.toISOString()).toBe("2026-05-25T16:00:00.000Z");
    expect(window.calendarDateEnd.toISOString()).toBe(
      "2026-05-26T16:00:00.000Z",
    );
    expect(window.includeWindowEnd).toBe(false);
  });

  it("dateTo 含时间且 inclusive 时包含边界", () => {
    const window = resolveCalendarEventWindow({
      dateFrom: shanghaiDate("2026-05-22T00:00:00+08:00"),
      dateFromIsDateOnly: false,
      dateTo: shanghaiDate("2026-05-25T18:00:00+08:00"),
      dateToInclusive: true,
      dateToIsDateOnly: false,
    });

    expect(window.windowEnd.toISOString()).toBe("2026-05-25T10:00:00.000Z");
    expect(window.includeWindowEnd).toBe(true);
  });

  it("dateTo 含时间且非 inclusive 时不包含边界", () => {
    const window = resolveCalendarEventWindow({
      dateFrom: shanghaiDate("2026-05-22T00:00:00+08:00"),
      dateFromIsDateOnly: false,
      dateTo: shanghaiDate("2026-05-25T18:00:00+08:00"),
      dateToInclusive: false,
      dateToIsDateOnly: false,
    });

    expect(window.windowEnd.toISOString()).toBe("2026-05-25T10:00:00.000Z");
    expect(window.includeWindowEnd).toBe(false);
  });
});

describe("日历事件窗口命中判断", () => {
  const windowStart = shanghaiDate("2026-05-22T00:00:00+08:00");
  const windowEnd = shanghaiDate("2026-05-25T00:00:00+08:00");

  it("overlap 模式在事件与窗口相交时命中", () => {
    expect(
      isWithinExactWindow(
        {
          start: shanghaiDate("2026-05-21T20:00:00+08:00"),
          end: shanghaiDate("2026-05-22T04:00:00+08:00"),
        },
        windowStart,
        windowEnd,
        false,
        "overlap",
      ),
    ).toBe(true);

    expect(
      isWithinExactWindow(
        {
          start: shanghaiDate("2026-05-22T08:00:00+08:00"),
          end: shanghaiDate("2026-05-22T10:00:00+08:00"),
        },
        windowStart,
        windowEnd,
        false,
        "overlap",
      ),
    ).toBe(true);
  });

  it("overlap 模式在事件完全在窗口外时未命中", () => {
    expect(
      isWithinExactWindow(
        {
          start: shanghaiDate("2026-05-25T08:00:00+08:00"),
          end: shanghaiDate("2026-05-25T10:00:00+08:00"),
        },
        windowStart,
        windowEnd,
        false,
        "overlap",
      ),
    ).toBe(false);

    expect(
      isWithinExactWindow(
        {
          start: shanghaiDate("2026-05-21T08:00:00+08:00"),
          end: shanghaiDate("2026-05-21T10:00:00+08:00"),
        },
        windowStart,
        windowEnd,
        false,
        "overlap",
      ),
    ).toBe(false);
  });

  it("overlap 模式无结束时间时退化为按开始时间判断", () => {
    expect(
      isWithinExactWindow(
        { start: shanghaiDate("2026-05-22T08:00:00+08:00"), end: null },
        windowStart,
        windowEnd,
        false,
        "overlap",
      ),
    ).toBe(true);

    expect(
      isWithinExactWindow(
        { start: shanghaiDate("2026-05-25T08:00:00+08:00"), end: null },
        windowStart,
        windowEnd,
        false,
        "overlap",
      ),
    ).toBe(false);
  });

  it("start 模式仅按事件开始时间判断", () => {
    expect(
      isWithinExactWindow(
        {
          start: shanghaiDate("2026-05-22T00:00:00+08:00"),
          end: shanghaiDate("2026-05-22T02:00:00+08:00"),
        },
        windowStart,
        windowEnd,
        false,
        "start",
      ),
    ).toBe(true);

    expect(
      isWithinExactWindow(
        {
          start: shanghaiDate("2026-05-21T20:00:00+08:00"),
          end: shanghaiDate("2026-05-22T04:00:00+08:00"),
        },
        windowStart,
        windowEnd,
        false,
        "start",
      ),
    ).toBe(false);
  });

  it("includeWindowEnd 为 true 时包含结束边界", () => {
    expect(
      isWithinExactWindow(
        {
          start: shanghaiDate("2026-05-25T00:00:00+08:00"),
          end: shanghaiDate("2026-05-25T02:00:00+08:00"),
        },
        windowStart,
        windowEnd,
        true,
        "start",
      ),
    ).toBe(true);

    expect(
      isWithinExactWindow(
        {
          start: shanghaiDate("2026-05-25T00:00:00+08:00"),
          end: shanghaiDate("2026-05-25T02:00:00+08:00"),
        },
        windowStart,
        windowEnd,
        false,
        "start",
      ),
    ).toBe(false);
  });

  it("开始时间为 null 或 NaN 时安全返回 false", () => {
    expect(
      isWithinExactWindow(
        { start: null, end: shanghaiDate("2026-05-22T10:00:00+08:00") },
        windowStart,
        windowEnd,
        false,
        "overlap",
      ),
    ).toBe(false);

    expect(
      isWithinExactWindow(
        { start: new Date(NaN), end: null },
        windowStart,
        windowEnd,
        false,
        "start",
      ),
    ).toBe(false);

    expect(
      isWithinExactWindow(
        {
          start: shanghaiDate("2026-05-22T08:00:00+08:00"),
          end: new Date(NaN),
        },
        windowStart,
        windowEnd,
        false,
        "overlap",
      ),
    ).toBe(false);
  });
});

describe("日历事件源映射", () => {
  it("将 schedule 的日期和时间组合为上海 ISO 字符串", () => {
    const event = mapScheduleCalendarEvent({
      date: shanghaiDate("2026-05-22"),
      endTime: 1000,
      startTime: 800,
    });

    expect(event.type).toBe("schedule");
    expect(event.at).toBe("2026-05-22T08:00:00+08:00");
    expect(event.filterStart?.toISOString()).toBe("2026-05-22T00:00:00.000Z");
    expect(event.filterEnd?.toISOString()).toBe("2026-05-22T02:00:00.000Z");
    expect(event.sortKey).toBe(event.filterStart?.getTime());
  });

  it("schedule 缺少日期时返回 null 时间并放到排序末尾", () => {
    const event = mapScheduleCalendarEvent({
      date: null,
      endTime: 1000,
      startTime: 800,
    });

    expect(event.at).toBeNull();
    expect(event.filterStart).toBeNull();
    expect(event.sortKey).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("将 homework 的 submissionDueAt 序列化为上海 ISO 字符串", () => {
    const event = mapHomeworkCalendarEvent({
      submissionDueAt: shanghaiDate("2026-05-22T23:00:00+08:00"),
    });

    expect(event.type).toBe("homework_due");
    expect(event.at).toBe("2026-05-22T23:00:00+08:00");
    expect(event.filterEnd).toBeNull();
  });

  it("将 exam 的日期和时间组合，无结束时间时延伸为全天", () => {
    const event = mapExamCalendarEvent({
      endTime: 1100,
      examDate: shanghaiDate("2026-05-22"),
      startTime: 900,
    });

    expect(event.type).toBe("exam");
    expect(event.at).toBe("2026-05-22T09:00:00+08:00");
    expect(event.filterEnd?.toISOString()).toBe("2026-05-22T03:00:00.000Z");
  });

  it("将 exam 的开始和结束时间均为空时视为全天事件", () => {
    const event = mapExamCalendarEvent({
      endTime: null,
      examDate: shanghaiDate("2026-05-22"),
      startTime: null,
    });

    expect(event.at).toBe("2026-05-22T00:00:00+08:00");
    expect(event.filterEnd?.toISOString()).toBe("2026-05-22T16:00:00.000Z");
  });

  it("将 todo 的 dueAt 序列化为上海 ISO 字符串", () => {
    const event = mapTodoCalendarEvent({
      dueAt: shanghaiDate("2026-05-22T20:00:00+08:00"),
    });

    expect(event.type).toBe("todo_due");
    expect(event.at).toBe("2026-05-22T20:00:00+08:00");
    expect(event.filterEnd).toBeNull();
  });
});

describe("日历事件合并与过滤", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-21T16:00:00.000Z"));
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("合并多个来源并按 sortKey 排序", async () => {
    loadCalendarEventSourcesMock.mockResolvedValueOnce({
      exams: [
        { examDate: shanghaiDate("2026-05-22"), endTime: 1000, startTime: 800 },
      ],
      homeworkItems: [
        { submissionDueAt: shanghaiDate("2026-05-22T10:00:00+08:00") },
      ],
      schedules: [
        { date: shanghaiDate("2026-05-22"), endTime: 1500, startTime: 1400 },
      ],
      todos: [{ dueAt: shanghaiDate("2026-05-22T18:00:00+08:00") }],
    });

    const events = await listUserCalendarEvents("user-1");

    expect(events.map((event) => event.type)).toEqual([
      "exam",
      "homework_due",
      "schedule",
      "todo_due",
    ]);
    expect(events.map((event) => event.at)).toEqual([
      "2026-05-22T08:00:00+08:00",
      "2026-05-22T10:00:00+08:00",
      "2026-05-22T14:00:00+08:00",
      "2026-05-22T18:00:00+08:00",
    ]);
  });

  it("按 overlap 模式过滤跨窗口边界的事件", async () => {
    loadCalendarEventSourcesMock.mockResolvedValueOnce({
      exams: [],
      homeworkItems: [
        { submissionDueAt: shanghaiDate("2026-05-22T10:00:00+08:00") },
        { submissionDueAt: shanghaiDate("2026-05-30T10:00:00+08:00") },
      ],
      schedules: [],
      todos: [],
    });

    const events = await listUserCalendarEvents("user-1");

    expect(events).toHaveLength(1);
    expect(events[0]?.at).toBe("2026-05-22T10:00:00+08:00");
  });

  it("按 start 模式过滤窗口外开始的事件", async () => {
    loadCalendarEventSourcesMock.mockResolvedValueOnce({
      exams: [],
      homeworkItems: [
        { submissionDueAt: shanghaiDate("2026-05-22T10:00:00+08:00") },
        { submissionDueAt: shanghaiDate("2026-05-22T14:00:00+08:00") },
      ],
      schedules: [],
      todos: [],
    });

    const events = await listUserCalendarEvents("user-1", {
      dateTo: shanghaiDate("2026-05-22T12:00:00+08:00"),
      eventWindowMode: "start",
    });

    expect(events).toHaveLength(1);
    expect(events[0]?.at).toBe("2026-05-22T10:00:00+08:00");
  });

  it("输出中剥离 filterStart/filterEnd/sortKey 内部字段", async () => {
    loadCalendarEventSourcesMock.mockResolvedValueOnce({
      exams: [],
      homeworkItems: [
        { submissionDueAt: shanghaiDate("2026-05-22T10:00:00+08:00") },
      ],
      schedules: [],
      todos: [],
    });

    const events = await listUserCalendarEvents("user-1");

    expect(events[0]).not.toHaveProperty("filterStart");
    expect(events[0]).not.toHaveProperty("filterEnd");
    expect(events[0]).not.toHaveProperty("sortKey");
    expect(events[0]).toHaveProperty("type");
    expect(events[0]).toHaveProperty("at");
    expect(events[0]).toHaveProperty("payload");
  });

  it("将 sectionIds 透传给事件源加载器", async () => {
    loadCalendarEventSourcesMock.mockResolvedValueOnce({
      exams: [],
      homeworkItems: [],
      schedules: [],
      todos: [],
    });

    await listUserCalendarEvents("user-1", { sectionIds: [1, 2] });

    expect(loadCalendarEventSourcesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sectionIds: [1, 2],
        userId: "user-1",
      }),
    );
  });
});
