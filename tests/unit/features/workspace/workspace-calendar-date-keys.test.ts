import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  monthWeeks,
  toDateKey,
  weekStartFor,
} from "@/features/workspace/lib/calendar-date-keys";
import {
  workspaceCalendarStateFromUrl,
  workspaceCalendarViewPatch,
} from "@/features/workspace/lib/calendar-navigation";
import { buildCalendarWeekdayLabels } from "@/features/workspace/lib/workspace-controller-labels";
import { getSemesterWeeks } from "@/features/workspace/server/workspace-calendar-helpers";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";

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
    const state = workspaceCalendarStateFromUrl(
      new URL("https://life.test/workspace?calendarView=week"),
      calendar,
    );

    expect(state).toEqual({
      day: "2026-03-02",
      month: "2026-03",
      semesterId: 42,
      view: "week",
      weekStart: "2026-03-01",
    });
    expect(workspaceCalendarViewPatch("week", calendar)).toEqual({
      semesterId: null,
      view: "week",
      week: "2026-03-01",
    });
  });
  it("aligns Sunday-first headers with official spring and autumn semester week dates", () => {
    const labels = buildCalendarWeekdayLabels({
      weekdays: {
        shortSunday: "Sun",
        shortMonday: "Mon",
        shortTuesday: "Tue",
        shortWednesday: "Wed",
        shortThursday: "Thu",
        shortFriday: "Fri",
        shortSaturday: "Sat",
      },
    });
    expect(labels).toEqual(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
    for (const [start, end, expectedSunday] of [
      ["2026-03-02", "2026-03-07", "2026-03-01"],
      ["2026-08-31", "2026-09-05", "2026-08-30"],
    ]) {
      const weeks = getSemesterWeeks(shanghaiDayjs(start), shanghaiDayjs(end));
      expect(weeks).toHaveLength(1);
      expect(weeks[0].map((day) => day.format("ddd"))).toEqual(labels);
      expect(weeks[0][0].format("YYYY-MM-DD")).toBe(expectedSunday);
      expect(weeks[0][6].format("YYYY-MM-DD")).toBe(end);
    }
    expect(weekStartFor("2027-01-01")).toBe("2026-12-27");
  });
});
