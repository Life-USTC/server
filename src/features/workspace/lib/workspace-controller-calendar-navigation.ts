import type { CalendarView } from "./calendar";
import { calendarSemesterIndex } from "./calendar-display";
import {
  type WorkspaceCalendarNavData,
  type WorkspaceCalendarState,
  type WorkspaceCalendarStatePatch,
  workspaceCalendarParams,
  workspaceCalendarStateFromPatch,
  workspaceCalendarStateFromUrl,
  workspaceCalendarViewPatch,
} from "./calendar-navigation";
import type { CalendarData } from "./workspace-controller-helpers";
import type { workspaceTabHref } from "./workspace-nav";

type WorkspaceTabHref = typeof workspaceTabHref;

type CalendarStateValues = {
  calendarDay: string;
  calendarMonth: string;
  calendarSemesterId: number | null;
  calendarView: CalendarView;
  calendarWeekStart: string;
};

export function workspaceCalendarStateFromValues({
  calendarDay,
  calendarMonth,
  calendarSemesterId,
  calendarView,
  calendarWeekStart,
}: CalendarStateValues): WorkspaceCalendarState {
  return {
    day: calendarDay,
    month: calendarMonth,
    semesterId: calendarSemesterId,
    view: calendarView,
    weekStart: calendarWeekStart,
  };
}

export function workspaceCalendarHrefFromPatch({
  currentState,
  patch,
  tabHref,
}: {
  currentState: WorkspaceCalendarState;
  patch: WorkspaceCalendarStatePatch;
  tabHref: WorkspaceTabHref;
}) {
  return tabHref(
    "calendar",
    workspaceCalendarParams(
      workspaceCalendarStateFromPatch(currentState, patch),
    ),
  );
}

export function workspaceCalendarUrlState(input: {
  calendar: CalendarData | null;
  url: URL;
}) {
  const { calendar, url } = input;
  if (
    calendar &&
    url.searchParams.get("calendarSemester") ===
      String(calendar.activeCalendarSemesterId)
  ) {
    const semesterDays = calendar.semesterWeeks.flat();
    const referenceDay = calendar.todayDate;
    if (
      semesterDays.length &&
      (!referenceDay || !semesterDays.includes(referenceDay))
    ) {
      const firstEventDay = [
        ...calendar.allSessions,
        ...calendar.allExams,
        ...calendar.semesterHomeworks,
      ]
        .map((event) => event.dateKey)
        .filter(
          (key): key is string =>
            typeof key === "string" && semesterDays.includes(key),
        )
        .sort()[0];
      return workspaceCalendarStateFromUrl(url, {
        ...calendar,
        referenceDate: firstEventDay ?? semesterDays[0],
      });
    }
  }
  return workspaceCalendarStateFromUrl(url, calendar);
}

export function workspaceCalendarStateChange(input: {
  currentState: WorkspaceCalendarState;
  patch: WorkspaceCalendarStatePatch;
  tabHref: WorkspaceTabHref;
}) {
  const state = workspaceCalendarStateFromPatch(
    input.currentState,
    input.patch,
  );
  return {
    href: input.tabHref("calendar", workspaceCalendarParams(state)),
    state,
  };
}

export function workspaceCalendarViewChange(input: {
  calendar: WorkspaceCalendarNavData | null;
  currentState: WorkspaceCalendarState;
  nextView: CalendarView;
  tabHref: WorkspaceTabHref;
}) {
  return workspaceCalendarStateChange({
    currentState: input.currentState,
    patch: workspaceCalendarViewPatch(input.nextView, input.calendar),
    tabHref: input.tabHref,
  });
}

export function workspaceCalendarDayChange(input: {
  currentState: WorkspaceCalendarState;
  day: string;
  tabHref: WorkspaceTabHref;
}) {
  return workspaceCalendarStateChange({
    currentState: input.currentState,
    patch: { day: input.day, semesterId: null, view: "day" },
    tabHref: input.tabHref,
  });
}

export function workspaceCalendarMonthChange(input: {
  currentState: WorkspaceCalendarState;
  month: string;
  tabHref: WorkspaceTabHref;
}) {
  return workspaceCalendarStateChange({
    currentState: input.currentState,
    patch: {
      month: input.month,
      semesterId: null,
      view: "month",
    },
    tabHref: input.tabHref,
  });
}

export function workspaceCalendarWeekChange(input: {
  currentState: WorkspaceCalendarState;
  tabHref: WorkspaceTabHref;
  week: string;
}) {
  return workspaceCalendarStateChange({
    currentState: input.currentState,
    patch: {
      semesterId: null,
      view: "week",
      week: input.week,
    },
    tabHref: input.tabHref,
  });
}

export function workspaceCalendarSemesterChange(input: {
  currentState: WorkspaceCalendarState;
  semesterId: number | null;
  tabHref: WorkspaceTabHref;
}) {
  return workspaceCalendarStateChange({
    currentState: input.currentState,
    patch: {
      semesterId: input.semesterId,
      view: "semester",
    },
    tabHref: input.tabHref,
  });
}

export function workspaceCalendarSemesterHref(input: {
  calendar: CalendarData;
  currentState: WorkspaceCalendarState;
  offset: number;
  tabHref: WorkspaceTabHref;
}) {
  const next =
    input.calendar.calendarSemesterNavList[
      calendarSemesterIndex(input.calendar) + input.offset
    ];
  return next
    ? workspaceCalendarStateChange({
        currentState: input.currentState,
        patch: {
          semesterId: next.id,
          view: "semester",
        },
        tabHref: input.tabHref,
      }).href
    : undefined;
}
