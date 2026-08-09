import { listSubscribedHomeworks } from "@/features/subscriptions/server/subscription-read-model";
import { formatSemesterName } from "@/lib/text/format-semester-name";
import {
  buildSemesterCalendarPayload,
  resolveGridSemesterBounds,
} from "./dashboard-overview-calendar";
import { resolveDashboardOverviewContext } from "./dashboard-overview-context";
import { getDashboardOverviewLinksData } from "./dashboard-overview-links";
import { buildDashboardOverviewSchedule } from "./dashboard-overview-schedule";
import { resolveDashboardOverviewSectionScope } from "./dashboard-overview-section-scope";
import { listSemesterCalendarTodos } from "./dashboard-overview-semester-todos";
import type {
  OverviewData,
  OverviewDataOptions,
} from "./dashboard-overview-types";

export {
  type DashboardNavStats,
  type DashboardUserContext,
  type DashboardUserSummary,
  getDashboardNavStats,
  getDashboardUserContext,
} from "./dashboard-nav-stats";
export { getDashboardSemesters } from "./dashboard-overview-context";
export type {
  CalendarTodoItem,
  OverviewData,
  OverviewDataOptions,
} from "./dashboard-overview-types";

export async function getDashboardOverviewData(
  userId: string,
  options: OverviewDataOptions = {},
): Promise<OverviewData | null> {
  const { locale, referenceNow, semesterContext, semesters, user } =
    await resolveDashboardOverviewContext(userId, options);

  if (!user) return null;

  const {
    calendarSemesterFromUrlValid,
    currentSemester,
    gridSemesterRow,
    scheduleDateEnd,
    scheduleDateStart,
  } = semesterContext;

  const { semesterEnd, semesterStart } =
    resolveGridSemesterBounds(gridSemesterRow);
  const sectionScopePromise = resolveDashboardOverviewSectionScope({
    calendarSemesterId: options.calendarSemesterId,
    currentSemester,
    gridSemesterRow,
    isCalendarSemesterFromUrlValid: calendarSemesterFromUrlValid,
    locale,
    sectionIds: options.sectionIds,
    scheduleDateEnd,
    scheduleDateStart,
    semesters,
    userId,
  });
  const linksPromise = getDashboardOverviewLinksData(userId, {
    locale,
    skipLinks: options.skipLinks,
  });
  const semesterTodosPromise = listSemesterCalendarTodos({
    semesterEnd,
    semesterStart,
    userId,
  });

  const {
    calendarSemesterNavList,
    calendarSemesterPicker,
    currentTermName,
    dashboardSections,
    hasAnySelection,
    hasCurrentTermSelection,
    homeworkSectionIds,
    sectionsForCalendarGrid,
  } = await sectionScopePromise;

  const now = referenceNow;
  const [
    overviewHomeworks,
    { dashboardLinks, recommendedLinks, pinnedLinks, overviewLinks },
    semesterTodos,
  ] = await Promise.all([
    listSubscribedHomeworks(userId, {
      incompleteOrHasDueDate: true,
      locale,
      sectionIds: homeworkSectionIds,
      shape: "dashboard",
    }),
    linksPromise,
    semesterTodosPromise,
  ]);
  const homeworks = overviewHomeworks.filter(
    (homework) => homework.homeworkCompletions.length === 0,
  );
  const calendarHomeworks = overviewHomeworks.filter(
    (homework) =>
      homework.submissionDueAt !== null &&
      homework.homeworkCompletions.length === 0,
  );
  const schedule = buildDashboardOverviewSchedule({
    dashboardSections,
    homeworks,
    locale,
    referenceNow: now,
  });
  const {
    allExams,
    allSessions,
    semesterEnd: calendarSemesterEnd,
    semesterHomeworks,
    semesterStart: calendarSemesterStart,
    semesterWeeks,
  } = buildSemesterCalendarPayload({
    calendarHomeworks,
    gridSemesterRow,
    sectionsForCalendarGrid,
    semesterTodos,
  });

  const defaultCalendarSemesterId = currentSemester?.id ?? null;
  const activeCalendarSemesterId = gridSemesterRow?.id ?? null;
  const activeCalendarSemesterName = gridSemesterRow?.nameCn
    ? formatSemesterName(locale, gridSemesterRow.nameCn)
    : null;

  return {
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
    },
    currentTermName,
    hasAnySelection,
    hasCurrentTermSelection,
    todaySessions: schedule.todaySessions,
    tomorrowSessions: schedule.tomorrowSessions,
    weeklySessions: schedule.weeklySessions,
    weekDays: schedule.weekDays,
    timeSlots: schedule.timeSlots,
    incompleteHomeworks: schedule.incompleteHomeworks,
    dueToday: schedule.dueToday,
    dueWithin3Days: schedule.dueWithin3Days,
    calendarSessions: schedule.calendarSessions,
    calendarHomeworks: schedule.calendarHomeworks,
    calendarDays: schedule.calendarDays,
    weekDayFormatter: schedule.weekDayFormatter,
    referenceNow: now,
    todayStart: schedule.todayStart,
    semesterStart: calendarSemesterStart,
    semesterEnd: calendarSemesterEnd,
    semesterWeeks,
    allSessions,
    allExams,
    semesterHomeworks,
    semesterTodos,
    calendarSemesterPicker,
    calendarSemesterNavList,
    activeCalendarSemesterId,
    defaultCalendarSemesterId,
    activeCalendarSemesterName,
    dashboardLinks,
    recommendedLinks,
    pinnedLinks,
    overviewLinks,
  };
}
