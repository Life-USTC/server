import { listSubscribedHomeworks } from "@/features/subscriptions/server/subscription-read-model";
import { formatSemesterName } from "@/lib/text/format-semester-name";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import {
  buildPreviewCalendarPayload,
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

function dayjsMin<T extends ReturnType<typeof shanghaiDayjs>>(
  left: T,
  right: T,
) {
  return left.isBefore(right) ? left : right;
}

function dayjsMax<T extends ReturnType<typeof shanghaiDayjs>>(
  left: T,
  right: T,
) {
  return left.isAfter(right) ? left : right;
}

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

  const calendarMode = options.calendarMode ?? "semester";
  const previewWeekStart = options.overviewWeek
    ? shanghaiDayjs(options.overviewWeek).startOf("week")
    : referenceNow.startOf("week");
  const previewStart = dayjsMin(referenceNow.startOf("day"), previewWeekStart);
  const previewEnd = dayjsMax(
    referenceNow.startOf("day").add(6, "day"),
    previewWeekStart.add(6, "day"),
  ).endOf("day");

  const { semesterEnd, semesterStart } =
    resolveGridSemesterBounds(gridSemesterRow);
  const sectionScopePromise = resolveDashboardOverviewSectionScope({
    calendarSemesterId: options.calendarSemesterId,
    currentSemester,
    gridSemesterRow,
    isCalendarSemesterFromUrlValid: calendarSemesterFromUrlValid,
    locale,
    sectionIds: options.sectionIds,
    scheduleDateEnd:
      calendarMode === "preview" ? previewEnd.toDate() : scheduleDateEnd,
    scheduleDateStart:
      calendarMode === "preview" ? previewStart.toDate() : scheduleDateStart,
    semesters,
    userId,
  });
  const linksPromise = getDashboardOverviewLinksData(userId, {
    locale,
    skipLinks: options.skipLinks,
  });
  const calendarTodosPromise = options.calendarTodos
    ? Promise.resolve(Array.from(options.calendarTodos))
    : listSemesterCalendarTodos({
        semesterEnd: calendarMode === "preview" ? previewEnd : semesterEnd,
        semesterStart:
          calendarMode === "preview" ? previewStart : semesterStart,
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
    calendarTodos,
  ] = await Promise.all([
    listSubscribedHomeworks(userId, {
      incompleteOrHasDueDate: true,
      locale,
      sectionIds: homeworkSectionIds,
      shape: "dashboard",
    }),
    linksPromise,
    calendarTodosPromise,
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
  const calendarPayload =
    calendarMode === "preview"
      ? buildPreviewCalendarPayload({
          calendarHomeworks,
          referenceNow: now,
          sections: sectionsForCalendarGrid,
          todos: calendarTodos,
          windowEnd: previewEnd,
          windowStart: previewStart,
        })
      : buildSemesterCalendarPayload({
          calendarHomeworks,
          gridSemesterRow,
          sectionsForCalendarGrid,
          semesterTodos: calendarTodos,
        });
  const {
    allExams,
    allSessions,
    semesterEnd: calendarSemesterEnd,
    semesterHomeworks,
    semesterStart: calendarSemesterStart,
    semesterTodos,
    semesterWeeks,
  } = calendarPayload;

  const defaultCalendarSemesterId = currentSemester?.id ?? null;
  const activeCalendarSemesterId = gridSemesterRow?.id ?? null;
  const activeCalendarSemesterName = gridSemesterRow?.nameCn
    ? formatSemesterName(locale, gridSemesterRow.nameCn)
    : null;

  return {
    calendarMode,
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
