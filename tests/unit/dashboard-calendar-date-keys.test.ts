import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  monthWeeks,
  toDateKey,
  weekStartFor,
} from "@/features/dashboard/lib/calendar-date-keys";
import {
  dashboardCalendarStateFromUrl,
  dashboardCalendarViewPatch,
} from "@/features/dashboard/lib/calendar-navigation";

describe("仪表盘日历日期键", () => {
  it("为仪表盘日期导航使用校区日期键", () => {
    expect(toDateKey(new Date("2026-03-01T15:59:59.000Z"))).toBe("2026-03-01");
    expect(toDateKey(new Date("2026-03-01T16:00:00.000Z"))).toBe("2026-03-02");
    expect(weekStartFor("2026-03-02")).toBe("2026-03-01");
    expect(addDays("2026-03-01", 7)).toBe("2026-03-08");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(monthWeeks("2026-03")[0]).toEqual([
      "2026-03-01",
      "2026-03-02",
      "2026-03-03",
      "2026-03-04",
      "2026-03-05",
      "2026-03-06",
      "2026-03-07",
    ]);
  });

  it("在推导 URL 状态前规范化仪表盘参考日期", () => {
    const calendar = {
      activeCalendarSemesterId: 42,
      referenceDate: "2026-03-01T16:00:00.000Z",
    };
    const state = dashboardCalendarStateFromUrl(
      new URL("https://life.test/workspace?calendarView=week"),
      calendar,
    );

    expect(state).toEqual({
      month: "2026-03",
      semesterId: 42,
      view: "week",
      weekStart: "2026-03-01",
    });
    expect(dashboardCalendarViewPatch("week", calendar)).toEqual({
      semesterId: null,
      view: "week",
      week: "2026-03-01",
    });
  });
});
