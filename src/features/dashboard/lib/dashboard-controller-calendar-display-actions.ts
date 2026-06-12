import type { calendarEventsForDay } from "./calendar";
import {
  calendarHomeworkHref as buildCalendarHomeworkHref,
  calendarTodoDetail as buildCalendarTodoDetail,
} from "./calendar-display";
import {
  buildDashboardCalendarTimelineItems,
  sessionHrefForDashboardCalendar,
} from "./dashboard-controller-calendar";
import type { CalendarData } from "./dashboard-controller-helpers";
import type { dashboardTabHref } from "./dashboard-nav";
import { formatMessage } from "./overview";

type DashboardTabHref = typeof dashboardTabHref;

export function createDashboardCalendarDisplayActions(input: {
  getCommonCourseLabel: () => string;
  getEventLabels: () => {
    exam: string;
    homework: string;
    todo: string;
  };
  getTodoPriorityLabel: (
    priority: CalendarData["semesterTodos"][number]["priority"],
  ) => string;
  getWeekNumberTemplate: () => string;
  tabHref: DashboardTabHref;
}) {
  function sessionHref(session: { sectionJwId: number | null }) {
    return sessionHrefForDashboardCalendar(session, input.tabHref);
  }

  function calendarWeekLabel(weekIndex: number) {
    return formatMessage(input.getWeekNumberTemplate(), {
      week: weekIndex + 1,
    });
  }

  function calendarHomeworkHref(
    homework: CalendarData["semesterHomeworks"][number],
  ) {
    return buildCalendarHomeworkHref(homework, input.tabHref("homeworks"));
  }

  function calendarTodoDetail(todo: CalendarData["semesterTodos"][number]) {
    return buildCalendarTodoDetail(
      todo,
      input.getTodoPriorityLabel(todo.priority),
    );
  }

  function calendarTimelineItemsForDay(
    events: ReturnType<typeof calendarEventsForDay>,
  ) {
    const labels = input.getEventLabels();
    return buildDashboardCalendarTimelineItems({
      commonCourseLabel: input.getCommonCourseLabel(),
      events,
      examLabel: labels.exam,
      homeworkHref: calendarHomeworkHref,
      homeworkLabel: labels.homework,
      sessionHref,
      tabHref: input.tabHref,
      todoDetail: calendarTodoDetail,
      todoLabel: labels.todo,
    });
  }

  return {
    calendarHomeworkHref,
    calendarTimelineItemsForDay,
    calendarTodoDetail,
    calendarWeekLabel,
    sessionHref,
  };
}
