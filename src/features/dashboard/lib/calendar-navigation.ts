import {
  type CalendarView,
  isCalendarView,
  isDateKey,
  isMonthKey,
  toDateKey,
  weekStartFor,
} from "@/features/dashboard/lib/calendar";

export type DashboardCalendarNavData = {
  activeCalendarSemesterId?: number | null;
  referenceDate?: string | null;
};

export type DashboardCalendarState = {
  month: string;
  semesterId: number | null;
  view: CalendarView;
  weekStart: string;
};

export type DashboardCalendarStatePatch = {
  month?: string;
  semesterId?: number | null;
  view?: CalendarView;
  week?: string;
};

export function dashboardCalendarStateFromUrl(
  url: URL,
  calendar: DashboardCalendarNavData | null,
): DashboardCalendarState {
  const requestedView = url.searchParams.get("calendarView");
  const view = isCalendarView(requestedView) ? requestedView : "semester";

  const referenceDate = calendar?.referenceDate ?? toDateKey(new Date());
  const requestedMonth = url.searchParams.get("calendarMonth");
  const month = isMonthKey(requestedMonth)
    ? requestedMonth
    : referenceDate.slice(0, 7);

  const requestedWeek = url.searchParams.get("calendarWeek");
  const week = isDateKey(requestedWeek) ? requestedWeek : referenceDate;

  return {
    month,
    semesterId: calendar?.activeCalendarSemesterId ?? null,
    view,
    weekStart: weekStartFor(week),
  };
}

export function dashboardCalendarStateFromPatch(
  current: DashboardCalendarState,
  patch: DashboardCalendarStatePatch,
): DashboardCalendarState {
  return {
    month: patch.month ?? current.month,
    semesterId: patch.semesterId ?? current.semesterId,
    view: patch.view ?? current.view,
    weekStart: patch.week ?? current.weekStart,
  };
}

export function dashboardCalendarParams(
  state: DashboardCalendarState,
): Record<string, string | number | null | undefined> {
  const params: Record<string, string | number | null | undefined> = {};
  if (state.view !== "semester") params.calendarView = state.view;
  if (state.view === "month" && state.month) params.calendarMonth = state.month;
  if (state.view === "week" && state.weekStart)
    params.calendarWeek = state.weekStart;
  if (state.semesterId) params.calendarSemester = state.semesterId;
  return params;
}

export function dashboardCalendarViewPatch(
  nextView: CalendarView,
  calendar: DashboardCalendarNavData | null,
): DashboardCalendarStatePatch {
  const referenceKey = calendar?.referenceDate ?? toDateKey(new Date());
  if (nextView === "month") {
    return {
      month: referenceKey.slice(0, 7),
      semesterId: null,
      view: "month",
    };
  }
  if (nextView === "week") {
    return {
      semesterId: null,
      view: "week",
      week: weekStartFor(referenceKey),
    };
  }
  return {
    semesterId: calendar?.activeCalendarSemesterId ?? null,
    view: "semester",
  };
}
