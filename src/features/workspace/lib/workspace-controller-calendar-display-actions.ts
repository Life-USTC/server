import type { calendarEventsForDay } from "./calendar";
import {
  calendarHomeworkHref as buildCalendarHomeworkHref,
  calendarTodoChipFields as buildCalendarTodoChipFields,
  calendarTodoDetail as buildCalendarTodoDetail,
} from "./calendar-display";
import { formatMessage } from "./overview";
import {
  buildWorkspaceCalendarTimelineItems,
  sessionHrefForWorkspaceCalendar,
} from "./workspace-controller-calendar";
import type { CalendarData } from "./workspace-controller-helpers";
import type { workspaceTabHref } from "./workspace-nav";

type WorkspaceTabHref = typeof workspaceTabHref;

export function createWorkspaceCalendarDisplayActions(input: {
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
  tabHref: WorkspaceTabHref;
}) {
  function sessionHref(session: { sectionJwId: number | null }) {
    return sessionHrefForWorkspaceCalendar(session, input.tabHref);
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

  function calendarTodoChipFields(todo: CalendarData["semesterTodos"][number]) {
    return buildCalendarTodoChipFields(
      todo,
      input.getTodoPriorityLabel(todo.priority),
    );
  }

  function calendarTimelineItemsForDay(
    events: ReturnType<typeof calendarEventsForDay>,
  ) {
    const labels = input.getEventLabels();
    return buildWorkspaceCalendarTimelineItems({
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
    calendarTodoChipFields,
    calendarTodoDetail,
    calendarWeekLabel,
    sessionHref,
  };
}
