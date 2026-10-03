import type { calendarEventsForDay } from "./calendar";
import {
  calendarHomeworkChipFields as buildCalendarHomeworkChipFields,
  calendarHomeworkHref as buildCalendarHomeworkHref,
  calendarTodoChipFields as buildCalendarTodoChipFields,
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
    noCompletionRequired: string;
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
      noCompletionRequired: labels.noCompletionRequired,
      sessionHref,
      tabHref: input.tabHref,
      todoFields: calendarTodoChipFields,
      todoLabel: labels.todo,
    });
  }

  return {
    calendarHomeworkChipFields: (
      homework: CalendarData["semesterHomeworks"][number],
    ) =>
      buildCalendarHomeworkChipFields(
        homework,
        input.getEventLabels().noCompletionRequired,
      ),
    calendarHomeworkHref,
    calendarTimelineItemsForDay,
    calendarTodoChipFields,
    calendarWeekLabel,
    sessionHref,
  };
}
