import type { CalendarView } from "./calendar";
import {
  workspaceCalendarSemesterHref as buildWorkspaceCalendarSemesterHref,
  workspaceCalendarMonthChange,
  workspaceCalendarSemesterChange,
  workspaceCalendarStateFromValues,
  workspaceCalendarUrlState,
  workspaceCalendarViewChange,
  workspaceCalendarWeekChange,
} from "./workspace-controller-calendar";
import type { CalendarData } from "./workspace-controller-helpers";
import type { workspaceTabHref } from "./workspace-nav";

type WorkspaceTabHref = typeof workspaceTabHref;

export function createWorkspaceCalendarActions(input: {
  getCalendarData: () => CalendarData | null;
  getCalendarMonth: () => string;
  getCalendarSemesterId: () => number | null;
  getCalendarView: () => CalendarView;
  getCalendarWeekStart: () => string;
  navigateUrl: (href: string) => void | Promise<void>;
  replaceUrl: (href: string) => void;
  setCalendarMonth: (value: string) => void;
  setCalendarSemesterId: (value: number | null) => void;
  setCalendarView: (value: CalendarView) => void;
  setCalendarWeekStart: (value: string) => void;
  tabHref: WorkspaceTabHref;
}) {
  function calendarState() {
    return workspaceCalendarStateFromValues({
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
    applyCalendarState(workspaceCalendarUrlState({ calendar, url }));
  }

  function setCalendarView(nextView: CalendarView) {
    const next = workspaceCalendarViewChange({
      calendar: input.getCalendarData(),
      currentState: calendarState(),
      nextView,
      tabHref: input.tabHref,
    });
    applyCalendarState(next.state);
    input.replaceUrl(next.href);
  }

  function setCalendarMonth(month: string) {
    const next = workspaceCalendarMonthChange({
      currentState: calendarState(),
      month,
      tabHref: input.tabHref,
    });
    applyCalendarState(next.state);
    input.replaceUrl(next.href);
  }

  function setCalendarWeek(week: string) {
    const next = workspaceCalendarWeekChange({
      currentState: calendarState(),
      tabHref: input.tabHref,
      week,
    });
    applyCalendarState(next.state);
    input.replaceUrl(next.href);
  }

  function setCalendarSemester(semesterId: number | null) {
    const next = workspaceCalendarSemesterChange({
      currentState: calendarState(),
      semesterId,
      tabHref: input.tabHref,
    });
    applyCalendarState(next.state);
    void input.navigateUrl(next.href);
  }

  function calendarSemesterHref(calendar: CalendarData, offset: number) {
    return buildWorkspaceCalendarSemesterHref({
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
