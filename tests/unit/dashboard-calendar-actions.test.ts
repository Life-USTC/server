import { describe, expect, it, vi } from "vitest";
import type { CalendarView } from "@/features/dashboard/lib/calendar";
import { createDashboardCalendarActions } from "@/features/dashboard/lib/dashboard-controller-calendar-actions";
import { dashboardTabHref } from "@/features/dashboard/lib/dashboard-nav";

describe("dashboard calendar actions", () => {
  function calendarActions() {
    const navigateUrl = vi.fn();
    const replaceUrl = vi.fn();
    let calendarMonth = "2026-02";
    let calendarSemesterId: number | null = 1;
    let calendarView: CalendarView = "semester";
    let calendarWeekStart = "2026-02-22";

    const actions = createDashboardCalendarActions({
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
      tabHref: dashboardTabHref,
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

  it("uses navigation for semester changes so dashboard load reruns", () => {
    const { actions, navigateUrl, replaceUrl, state } = calendarActions();

    actions.setCalendarSemester(2);

    expect(state()).toMatchObject({
      calendarSemesterId: 2,
      calendarView: "semester",
    });
    expect(navigateUrl).toHaveBeenCalledWith(
      "/dashboard/calendar?calendarSemester=2",
    );
    expect(replaceUrl).not.toHaveBeenCalled();
  });

  it("keeps month changes as local URL replacements", () => {
    const { actions, navigateUrl, replaceUrl, state } = calendarActions();

    actions.setCalendarMonth("2026-03");

    expect(state()).toMatchObject({
      calendarMonth: "2026-03",
      calendarView: "month",
    });
    expect(replaceUrl).toHaveBeenCalledWith(
      "/dashboard/calendar?calendarView=month&calendarMonth=2026-03&calendarSemester=1",
    );
    expect(navigateUrl).not.toHaveBeenCalled();
  });
});
