import type { CalendarView } from "./calendar";
import {
  dashboardCalendarSemesterHref as buildDashboardCalendarSemesterHref,
  dashboardCalendarMonthChange,
  dashboardCalendarSemesterChange,
  dashboardCalendarStateFromValues,
  dashboardCalendarUrlState,
  dashboardCalendarViewChange,
  dashboardCalendarWeekChange,
} from "./dashboard-controller-calendar";
import type { CalendarData } from "./dashboard-controller-helpers";
import type { dashboardTabHref } from "./dashboard-nav";

type DashboardTabHref = typeof dashboardTabHref;

export function createDashboardCalendarActions(input: {
  getCalendarData: () => CalendarData | null;
  getCalendarMonth: () => string;
  getCalendarSemesterId: () => number | null;
  getCalendarView: () => CalendarView;
  getCalendarWeekStart: () => string;
  replaceUrl: (href: string) => void;
  setCalendarMonth: (value: string) => void;
  setCalendarSemesterId: (value: number | null) => void;
  setCalendarView: (value: CalendarView) => void;
  setCalendarWeekStart: (value: string) => void;
  tabHref: DashboardTabHref;
}) {
  function calendarState() {
    return dashboardCalendarStateFromValues({
      calendarMonth: input.getCalendarMonth(),
      calendarSemesterId: input.getCalendarSemesterId(),
      calendarView: input.getCalendarView(),
      calendarWeekStart: input.getCalendarWeekStart(),
    });
  }

  function applyCalendarState(state: ReturnType<typeof calendarState>) {
    input.setCalendarView(state.view);
    input.setCalendarMonth(state.month);
    input.setCalendarWeekStart(state.weekStart);
    input.setCalendarSemesterId(state.semesterId);
  }

  function syncCalendarStateFromUrl(url: URL, calendar: CalendarData | null) {
    applyCalendarState(dashboardCalendarUrlState({ calendar, url }));
  }

  function setCalendarView(nextView: CalendarView) {
    const next = dashboardCalendarViewChange({
      calendar: input.getCalendarData(),
      currentState: calendarState(),
      nextView,
      tabHref: input.tabHref,
    });
    applyCalendarState(next.state);
    input.replaceUrl(next.href);
  }

  function setCalendarMonth(month: string) {
    const next = dashboardCalendarMonthChange({
      currentState: calendarState(),
      month,
      tabHref: input.tabHref,
    });
    applyCalendarState(next.state);
    input.replaceUrl(next.href);
  }

  function setCalendarWeek(week: string) {
    const next = dashboardCalendarWeekChange({
      currentState: calendarState(),
      tabHref: input.tabHref,
      week,
    });
    applyCalendarState(next.state);
    input.replaceUrl(next.href);
  }

  function setCalendarSemester(semesterId: number | null) {
    const next = dashboardCalendarSemesterChange({
      currentState: calendarState(),
      semesterId,
      tabHref: input.tabHref,
    });
    applyCalendarState(next.state);
    input.replaceUrl(next.href);
  }

  function calendarSemesterHref(calendar: CalendarData, offset: number) {
    return buildDashboardCalendarSemesterHref({
      calendar,
      currentState: calendarState(),
      offset,
      tabHref: input.tabHref,
    });
  }

  return {
    calendarSemesterHref,
    setCalendarMonth,
    setCalendarSemester,
    setCalendarView,
    setCalendarWeek,
    syncCalendarStateFromUrl,
  };
}
