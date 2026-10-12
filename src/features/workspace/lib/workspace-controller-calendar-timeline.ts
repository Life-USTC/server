import type { calendarEventsForDay } from "./calendar";
import {
  buildCalendarTimelineItemsForDay,
  type CalendarEventChipFields,
  type CalendarEvents,
  calendarExamChipFields,
  calendarHomeworkChipFields,
  calendarSessionTimelineFields,
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
  noCompletionRequired,
  sessionHref,
  tabHref,
  todoFields,
  todoLabel,
}: {
  commonCourseLabel: string;
  events: ReturnType<typeof calendarEventsForDay>;
  examLabel: string;
  homeworkHref: (homework: CalendarData["semesterHomeworks"][number]) => string;
  homeworkLabel: string;
  noCompletionRequired: string;
  sessionHref: (session: { sectionJwId: number | null }) => string;
  tabHref: WorkspaceTabHref;
  todoFields: (
    todo: CalendarData["semesterTodos"][number],
  ) => CalendarEventChipFields;
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
      examFields: calendarExamChipFields,
      examLabel,
      examsHref: tabHref("exams"),
      homeworkFields: (homework) =>
        calendarHomeworkChipFields(homework, noCompletionRequired),
      homeworkHref,
      homeworkLabel,
      sessionFields: calendarSessionTimelineFields,
      sessionHref,
      todoFields,
      todoLabel,
      todosHref: tabHref("todos"),
    },
  );
}
