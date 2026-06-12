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
  DashboardCalendarData,
} from "./dashboard-controller-helpers";
import type { dashboardTabHref } from "./dashboard-nav";

type DashboardTabHref = typeof dashboardTabHref;

export function sessionHrefForDashboardCalendar(
  session: { sectionJwId: number | null },
  tabHref: DashboardTabHref,
) {
  return session.sectionJwId
    ? `/sections/${session.sectionJwId}`
    : tabHref("subscriptions");
}

export function buildDashboardCalendarTimelineItems({
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
  tabHref: DashboardTabHref;
  todoDetail: (todo: CalendarData["semesterTodos"][number]) => string;
  todoLabel: string;
}) {
  return buildCalendarTimelineItemsForDay(
    events as CalendarEvents<
      DashboardCalendarData["allSessions"][number],
      DashboardCalendarData["allExams"][number],
      DashboardCalendarData["semesterHomeworks"][number],
      DashboardCalendarData["semesterTodos"][number]
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
