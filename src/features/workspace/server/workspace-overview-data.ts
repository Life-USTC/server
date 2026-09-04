import { listSubscribedHomeworks } from "@/features/subscriptions/server/subscription-read-model";
import { formatSemesterName } from "@/lib/text/format-semester-name";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import {
  buildPreviewCalendarPayload,
  buildSemesterCalendarPayload,
  resolveGridSemesterBounds,
} from "./workspace-overview-calendar";
import { resolveWorkspaceOverviewContext } from "./workspace-overview-context";
import { getWorkspaceOverviewLinksData } from "./workspace-overview-links";
import { buildWorkspaceOverviewSchedule } from "./workspace-overview-schedule";
import { resolveWorkspaceOverviewSectionScope } from "./workspace-overview-section-scope";
import { listSemesterCalendarTodos } from "./workspace-overview-semester-todos";
import type {
  OverviewData,
  OverviewDataOptions,
} from "./workspace-overview-types";

export {
  getWorkspaceNavStats,
  getWorkspaceUserContext,
  type WorkspaceNavStats,
  type WorkspaceUserContext,
  type WorkspaceUserSummary,
} from "./workspace-nav-stats";
export { getWorkspaceSemesters } from "./workspace-overview-context";
export type {
  CalendarTodoItem,
  OverviewData,
  OverviewDataOptions,
} from "./workspace-overview-types";

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

export async function getWorkspaceOverviewData(
  userId: string,
  options: OverviewDataOptions = {},
): Promise<OverviewData | null> {
  const { locale, referenceNow, semesterContext, semesters, user } =
    await resolveWorkspaceOverviewContext(userId, options);

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
  const sectionScopePromise = resolveWorkspaceOverviewSectionScope({
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
  const linksPromise = getWorkspaceOverviewLinksData(userId, {
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
    workspaceSections,
    hasAnySelection,
    hasCurrentTermSelection,
    homeworkSectionIds,
    sectionsForCalendarGrid,
  } = await sectionScopePromise;

  const now = referenceNow;
  const [
    overviewHomeworks,
    { catalogLinks, recommendedLinks, pinnedLinks, overviewLinks },
    calendarTodos,
  ] = await Promise.all([
    listSubscribedHomeworks(userId, {
      incompleteOrHasDueDate: true,
      locale,
      sectionIds: homeworkSectionIds,
      shape: "workspace",
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
  const schedule = buildWorkspaceOverviewSchedule({
    workspaceSections,
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
    catalogLinks,
    recommendedLinks,
    pinnedLinks,
    overviewLinks,
  };
}
