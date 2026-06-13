import { buildSemesterCalendarPayload } from "./dashboard-overview-calendar";
import { resolveDashboardOverviewContext } from "./dashboard-overview-context";
import { getDashboardOverviewLinksData } from "./dashboard-overview-links";
import { buildDashboardOverviewSchedule } from "./dashboard-overview-schedule";
import { resolveDashboardOverviewSectionScope } from "./dashboard-overview-section-scope";
import type {
  OverviewData,
  OverviewDataOptions,
} from "./dashboard-overview-types";
import { listSubscribedHomeworks } from "./subscription-read-model";

export {
  type DashboardNavStats,
  type DashboardUserContext,
  type DashboardUserSummary,
  getDashboardNavStats,
  getDashboardUserContext,
} from "./dashboard-nav-stats";
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

  const linksPromise = getDashboardOverviewLinksData(userId, {
    skipLinks: options.skipLinks,
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
  } = await resolveDashboardOverviewSectionScope({
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

  const now = referenceNow;
  const [homeworks, calendarHomeworks] = await Promise.all([
    listSubscribedHomeworks(userId, {
      locale,
      completed: false,
      sectionIds: homeworkSectionIds,
      shape: "dashboard",
    }),
    listSubscribedHomeworks(userId, {
      locale,
      requireDueDate: true,
      sectionIds: homeworkSectionIds,
      shape: "dashboard",
    }),
  ]);
  const schedule = buildDashboardOverviewSchedule({
    dashboardSections,
    homeworks,
    locale,
    referenceNow: now,
  });
  const [
    {
      allExams,
      allSessions,
      semesterEnd,
      semesterHomeworks,
      semesterStart,
      semesterTodos,
      semesterWeeks,
    },
    { dashboardLinks, recommendedLinks, pinnedLinks, overviewLinks },
  ] = await Promise.all([
    buildSemesterCalendarPayload({
      calendarHomeworks,
      gridSemesterRow,
      sectionsForCalendarGrid,
      userId,
    }),
    linksPromise,
  ]);

  const defaultCalendarSemesterId = currentSemester?.id ?? null;
  const activeCalendarSemesterId = gridSemesterRow?.id ?? null;
  const activeCalendarSemesterName = gridSemesterRow?.nameCn ?? null;

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
    semesterStart,
    semesterEnd,
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
