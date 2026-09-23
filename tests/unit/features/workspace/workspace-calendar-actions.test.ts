import { describe, expect, it, vi } from "vitest";
import type { CalendarView } from "@/features/workspace/lib/calendar";
import { createWorkspaceCalendarActions } from "@/features/workspace/lib/workspace-controller-calendar-actions";
import { workspaceTabHref } from "@/features/workspace/lib/workspace-nav";

describe("仪表盘日历操作", () => {
  function calendarActions() {
    const navigateUrl = vi.fn();
    const replaceUrl = vi.fn();
    let calendarMonth = "2026-02";
    let calendarSemesterId: number | null = 1;
    let calendarView: CalendarView = "semester";
    let calendarWeekStart = "2026-02-22";

    const actions = createWorkspaceCalendarActions({
      getCalendarData: () => null,
      getCalendarMonth: () => calendarMonth,
      getCalendarSemesterId: () => calendarSemesterId,
      getCalendarView: () => calendarView,
      getCalendarWeekStart: () => calendarWeekStart,
      navigateUrl,
      replaceUrl,
      setCalendarMonth: (value) => {
        calendarMonth = value;
      },
      setCalendarSemesterId: (value) => {
        calendarSemesterId = value;
      },
      setCalendarView: (value) => {
        calendarView = value;
      },
      setCalendarWeekStart: (value) => {
        calendarWeekStart = value;
      },
      tabHref: workspaceTabHref,
    });

    return {
      actions,
      navigateUrl,
      replaceUrl,
      state: () => ({
        calendarMonth,
        calendarSemesterId,
        calendarView,
        calendarWeekStart,
      }),
    };
  }

  it("学期变更使用导航以便仪表盘重新加载", () => {
    const { actions, navigateUrl, replaceUrl, state } = calendarActions();

    actions.setCalendarSemester(2);

    expect(state()).toMatchObject({
      calendarSemesterId: 2,
      calendarView: "semester",
    });
    expect(navigateUrl).toHaveBeenCalledWith(
      "/workspace/calendar?calendarSemester=2",
    );
    expect(replaceUrl).not.toHaveBeenCalled();
  });

  it("月份变更保持为本地 URL 替换", () => {
    const { actions, navigateUrl, replaceUrl, state } = calendarActions();

    actions.setCalendarMonth("2026-03");

    expect(state()).toMatchObject({
      calendarMonth: "2026-03",
      calendarView: "month",
    });
    expect(replaceUrl).toHaveBeenCalledWith(
      "/workspace/calendar?calendarView=month&calendarMonth=2026-03&calendarSemester=1",
    );
    expect(navigateUrl).not.toHaveBeenCalled();
  });
});
