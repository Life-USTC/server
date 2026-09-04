import type { calendarEventsForDay } from "./calendar";
import {
  buildCalendarTimelineItemsForDay,
  type CalendarEvents,
  calendarExamDetail,
  calendarHomeworkDetail,
  calendarSessionDetail,
} from "./calendar-display";
import type {
  CalendarData,
  WorkspaceCalendarData,
} from "./workspace-controller-helpers";
import type { workspaceTabHref } from "./workspace-nav";

type WorkspaceTabHref = typeof workspaceTabHref;

export function sessionHrefForWorkspaceCalendar(
  session: { sectionJwId: number | null },
  tabHref: WorkspaceTabHref,
) {
  return session.sectionJwId
    ? `/catalog/sections/${session.sectionJwId}`
    : tabHref("subscriptions");
}

export function buildWorkspaceCalendarTimelineItems({
  commonCourseLabel,
  events,
  examLabel,
  homeworkHref,
  homeworkLabel,
  sessionHref,
  tabHref,
  todoDetail,
  todoLabel,
}: {
  commonCourseLabel: string;
  events: ReturnType<typeof calendarEventsForDay>;
  examLabel: string;
  homeworkHref: (homework: CalendarData["semesterHomeworks"][number]) => string;
  homeworkLabel: string;
  sessionHref: (session: { sectionJwId: number | null }) => string;
  tabHref: WorkspaceTabHref;
  todoDetail: (todo: CalendarData["semesterTodos"][number]) => string;
  todoLabel: string;
}) {
  return buildCalendarTimelineItemsForDay(
    events as CalendarEvents<
      WorkspaceCalendarData["allSessions"][number],
      WorkspaceCalendarData["allExams"][number],
      WorkspaceCalendarData["semesterHomeworks"][number],
      WorkspaceCalendarData["semesterTodos"][number]
    >,
    {
      courseLabel: commonCourseLabel,
      examDetail: calendarExamDetail,
      examLabel,
      examsHref: tabHref("exams"),
      homeworkDetail: calendarHomeworkDetail,
      homeworkHref,
      homeworkLabel,
      sessionDetail: calendarSessionDetail,
      sessionHref,
      todoDetail,
      todoLabel,
      todosHref: tabHref("todos"),
    },
  );
}
