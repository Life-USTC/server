import {
  calendarDateKey,
  dashboardHomeworkItem,
} from "@/features/dashboard/server/dashboard-page-server";
import type { OverviewData } from "@/features/home/server/dashboard-overview-data";

export function serializeDashboardOverview(overview: OverviewData) {
  const homeworkItems = new Map(
    [
      ...overview.dueToday,
      ...overview.dueWithin3Days,
      ...overview.incompleteHomeworks,
    ].map((homework) => [homework.id, homework]),
  );

  return {
    user: overview.user,
    currentTermName: overview.currentTermName,
    hasAnySelection: overview.hasAnySelection,
    hasCurrentTermSelection: overview.hasCurrentTermSelection,
    todaySessions: overview.todaySessions,
    tomorrowSessions: overview.tomorrowSessions,
    dueToday: overview.dueToday.map(dashboardHomeworkItem),
    dueWithin3Days: overview.dueWithin3Days.map(dashboardHomeworkItem),
    pendingHomeworks: Array.from(homeworkItems.values()).map(
      dashboardHomeworkItem,
    ),
    calendar: {
      todayDate: overview.todayStart.format("YYYY-MM-DD"),
      referenceDate: overview.referenceNow.format("YYYY-MM-DD"),
      semesterStart: overview.semesterStart?.format("YYYY-MM-DD") ?? null,
      semesterEnd: overview.semesterEnd?.format("YYYY-MM-DD") ?? null,
      semesterWeeks: overview.semesterWeeks.map((week) =>
        week.map((day) => day.format("YYYY-MM-DD")),
      ),
      allSessions: overview.allSessions.map((session) => ({
        id: session.id,
        sectionJwId: session.sectionJwId,
        courseName: session.courseName,
        date: session.date,
        dateKey: calendarDateKey(session.date),
        startTime: session.startTime,
        endTime: session.endTime,
        location: session.location,
        teacherDisplay: session.teacherDisplay,
      })),
      allExams: overview.allExams.map((exam) => ({
        id: exam.id,
        courseName: exam.courseName,
        date: exam.date,
        dateKey: calendarDateKey(exam.date),
        startTime: exam.startTime,
        endTime: exam.endTime,
        examMode: exam.examMode,
        rooms: exam.rooms,
      })),
      semesterHomeworks: overview.semesterHomeworks.map((homework) => ({
        ...dashboardHomeworkItem(homework),
        description: homework.description?.content ?? null,
        dateKey: calendarDateKey(homework.submissionDueAt),
      })),
      semesterTodos: overview.semesterTodos.map((todo) => ({
        ...todo,
        dateKey: calendarDateKey(todo.dueAt),
      })),
      calendarSemesterNavList: overview.calendarSemesterNavList,
      activeCalendarSemesterId: overview.activeCalendarSemesterId,
      defaultCalendarSemesterId: overview.defaultCalendarSemesterId,
      activeCalendarSemesterName: overview.activeCalendarSemesterName,
    },
    overviewLinks: overview.overviewLinks,
  };
}
