import { describe, expect, it } from "vitest";
import {
  calendarMonthOffsetForDateKey,
  findCalendarBaseMonth,
} from "@/features/section-detail/lib/calendar";
import {
  addMonths,
  calendarMonthDays,
  dateKey,
  formatDate,
  isSameMonth,
} from "@/features/section-detail/lib/date-display";

describe("课程详情日期展示", () => {
  it("根据校区日期边界派生日历键", () => {
    const boundary = new Date("2026-03-01T16:00:00.000Z");
    const campusFormatted = new Intl.DateTimeFormat(undefined, {
      timeZone: "Asia/Shanghai",
    }).format(boundary);

    expect(dateKey(new Date("2026-03-01T15:59:59.000Z"))).toBe("2026-03-01");
    expect(dateKey(boundary)).toBe("2026-03-02");
    expect(formatDate(boundary, "n/a")).toBe(campusFormatted);
  });

  it("基于共享的周日周策略构建课程月份网格键", () => {
    const monthStart = findCalendarBaseMonth([
      {
        badges: [],
        date: "2026-03-01T16:00:00.000Z",
        dateKey: "2026-03-02",
        details: [],
        id: "event-1",
        kind: "class",
        meta: "",
        sortValue: 0,
        title: "Class",
      },
    ]);
    const days = calendarMonthDays(monthStart);
    const firstDay = days[0];
    const lastDay = days.at(-1);

    if (!firstDay || !lastDay) {
      throw new Error("Expected section month grid days");
    }

    expect(days).toHaveLength(42);
    expect(dateKey(monthStart)).toBe("2026-03-01");
    expect(dateKey(firstDay)).toBe("2026-03-01");
    expect(dateKey(days[1])).toBe("2026-03-02");
    expect(dateKey(lastDay)).toBe("2026-04-11");
    expect(isSameMonth(firstDay, monthStart)).toBe(true);
    expect(isSameMonth(lastDay, monthStart)).toBe(false);
  });

  it("从课程基准月计算“今天”的月份偏移", () => {
    const baseMonth = findCalendarBaseMonth([
      {
        badges: [],
        date: "2026-04-29T00:00:00+08:00",
        dateKey: "2026-04-29",
        details: [],
        id: "event-1",
        kind: "class",
        meta: "",
        sortValue: 0,
        title: "Class",
      },
    ]);

    const offset = calendarMonthOffsetForDateKey(baseMonth, "2026-06-27");

    expect(dateKey(baseMonth)).toBe("2026-04-01");
    expect(offset).toBe(2);
    expect(dateKey(addMonths(baseMonth, offset))).toBe("2026-06-01");
  });

  it("使用提供的 today 键作为空日历基准月", () => {
    const monthStart = findCalendarBaseMonth([], "2026-06-27");

    expect(dateKey(monthStart)).toBe("2026-06-01");
  });
});
