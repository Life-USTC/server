import type { CalendarView } from "./calendar";
import { calendarSemesterIndex } from "./calendar-display";
import {
  type DashboardCalendarNavData,
  type DashboardCalendarState,
  type DashboardCalendarStatePatch,
  dashboardCalendarParams,
  dashboardCalendarStateFromPatch,
  dashboardCalendarStateFromUrl,
  dashboardCalendarViewPatch,
} from "./calendar-navigation";
import type { CalendarData } from "./dashboard-controller-helpers";
import type { dashboardTabHref } from "./dashboard-nav";

type DashboardTabHref = typeof dashboardTabHref;

type CalendarStateValues = {
  calendarMonth: string;
  calendarSemesterId: number | null;
  calendarView: CalendarView;
  calendarWeekStart: string;
};

export function dashboardCalendarStateFromValues({
  calendarMonth,
  calendarSemesterId,
  calendarView,
  calendarWeekStart,
}: CalendarStateValues): DashboardCalendarState {
  return {
    month: calendarMonth,
    semesterId: calendarSemesterId,
    view: calendarView,
    weekStart: calendarWeekStart,
  };
}

export function dashboardCalendarHrefFromPatch({
  currentState,
  patch,
  tabHref,
}: {
  currentState: DashboardCalendarState;
  patch: DashboardCalendarStatePatch;
  tabHref: DashboardTabHref;
}) {
  return tabHref(
    "calendar",
    dashboardCalendarParams(
      dashboardCalendarStateFromPatch(currentState, patch),
    ),
  );
}

export function dashboardCalendarUrlState(input: {
  calendar: DashboardCalendarNavData | null;
  url: URL;
}) {
  return dashboardCalendarStateFromUrl(input.url, input.calendar);
}

export function dashboardCalendarStateChange(input: {
  currentState: DashboardCalendarState;
  patch: DashboardCalendarStatePatch;
  tabHref: DashboardTabHref;
}) {
  const state = dashboardCalendarStateFromPatch(
    input.currentState,
    input.patch,
  );
  return {
    href: input.tabHref("calendar", dashboardCalendarParams(state)),
    state,
  };
}

export function dashboardCalendarViewChange(input: {
  calendar: DashboardCalendarNavData | null;
  currentState: DashboardCalendarState;
  nextView: CalendarView;
  tabHref: DashboardTabHref;
}) {
  return dashboardCalendarStateChange({
    currentState: input.currentState,
    patch: dashboardCalendarViewPatch(input.nextView, input.calendar),
    tabHref: input.tabHref,
  });
}

export function dashboardCalendarMonthChange(input: {
  currentState: DashboardCalendarState;
  month: string;
  tabHref: DashboardTabHref;
}) {
  return dashboardCalendarStateChange({
    currentState: input.currentState,
    patch: {
      month: input.month,
      semesterId: null,
      view: "month",
    },
    tabHref: input.tabHref,
  });
}

export function dashboardCalendarWeekChange(input: {
  currentState: DashboardCalendarState;
  tabHref: DashboardTabHref;
  week: string;
}) {
  return dashboardCalendarStateChange({
    currentState: input.currentState,
    patch: {
      semesterId: null,
      view: "week",
      week: input.week,
    },
    tabHref: input.tabHref,
  });
}

export function dashboardCalendarSemesterChange(input: {
  currentState: DashboardCalendarState;
  semesterId: number | null;
  tabHref: DashboardTabHref;
}) {
  return dashboardCalendarStateChange({
    currentState: input.currentState,
    patch: {
      semesterId: input.semesterId,
      view: "semester",
    },
    tabHref: input.tabHref,
  });
}

export function dashboardCalendarSemesterHref(input: {
  calendar: CalendarData;
  currentState: DashboardCalendarState;
  offset: number;
  tabHref: DashboardTabHref;
}) {
  const next =
    input.calendar.calendarSemesterNavList[
      calendarSemesterIndex(input.calendar) + input.offset
    ];
  return next
    ? dashboardCalendarStateChange({
        currentState: input.currentState,
        patch: {
          semesterId: next.id,
          view: "semester",
        },
        tabHref: input.tabHref,
      }).href
    : undefined;
}
