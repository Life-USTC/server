import type dayjs from "dayjs";
import { getLocale } from "next-intl/server";
import type { TodoPriority } from "@/generated/prisma/client";
import { selectCurrentSemesterFromList } from "@/lib/current-semester";
import { prisma as basePrisma, getPrisma } from "@/lib/db/prisma";
import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import {
  createWeekDayFormatter,
  getDefaultWeekRange,
} from "@/shared/lib/date-utils";
import {
  buildExams,
  buildSessions,
  buildTimeSlots,
  buildWeekDays,
  computeHomeworkBuckets,
  filterSessionsByDay,
  getSemesterWeeks,
  resolveDashboardSections,
  selectWeeklySessions,
  sortSessionsByStart,
} from "./dashboard-helpers";
import {
  type DashboardLinkSummary,
  getSignedInDashboardLinksData,
} from "./dashboard-link-data";
import type {
  ExamItem,
  HomeworkWithSection,
  SessionItem,
} from "./dashboard-types";
import {
  listSubscribedDashboardSections,
  listSubscribedHomeworks,
} from "./subscription-read-model";

export type OverviewDataOptions = {
  /** Calendar tab: show semester/month/week grid for this semester (any known term). */
  calendarSemesterId?: number;
  /** Skip dashboard-links queries when the caller doesn't need them (e.g. calendar tab). */
  skipLinks?: boolean;
  /** Override the current time for deterministic snapshot and test views. */
  referenceNow?: Date;
  /** User row already loaded by the page shell. */
  user?: DashboardUserSummary;
  /** Subscription ids already loaded by the page shell. */
  sectionIds?: readonly number[];
};

export type DashboardUserSummary = {
  id: string;
  name: string | null;
  username: string | null;
};

export type DashboardUserContext = {
  user: DashboardUserSummary & { calendarFeedToken: string | null };
  sectionIds: number[];
};

export type DashboardNavStats = {
  user: DashboardUserSummary;
  pendingHomeworksCount: number;
  highlightPendingHomeworks: boolean;
  examsCount: number;
  pendingTodosCount: number;
};

export async function getDashboardUserContext(
  userId: string,
): Promise<DashboardUserContext | null> {
  const user = await basePrisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      username: true,
      calendarFeedToken: true,
      subscribedSections: {
        select: { id: true },
      },
    },
  });

  if (!user) return null;

  return {
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      calendarFeedToken: user.calendarFeedToken,
    },
    sectionIds: user.subscribedSections.map((section) => section.id),
  };
}

export async function getDashboardNavStats(
  user: DashboardUserSummary,
  sectionIds: readonly number[],
  referenceDate?: Date,
): Promise<DashboardNavStats> {
  const referenceNow = referenceDate
    ? shanghaiDayjs(referenceDate)
    : shanghaiDayjs();
  const todayStart = referenceNow.startOf("day");
  const tomorrowStart = todayStart.add(1, "day");
  const nowHHmm = referenceNow.hour() * 100 + referenceNow.minute();

  const pendingTodosCountPromise = basePrisma.todo.count({
    where: { userId: user.id, completed: false },
  });

  if (sectionIds.length === 0) {
    const pendingTodosCount = await pendingTodosCountPromise;

    return {
      user: { id: user.id, name: user.name, username: user.username },
      pendingHomeworksCount: 0,
      highlightPendingHomeworks: false,
      examsCount: 0,
      pendingTodosCount,
    };
  }

  const scopedSectionIds = Array.from(sectionIds);
  const [
    pendingTodosCount,
    pendingHomeworksCount,
    dueTodayHomework,
    examsCount,
  ] = await Promise.all([
    pendingTodosCountPromise,
    basePrisma.homework.count({
      where: {
        deletedAt: null,
        sectionId: { in: scopedSectionIds },
        homeworkCompletions: { none: { userId: user.id } },
      },
    }),
    basePrisma.homework.findFirst({
      where: {
        deletedAt: null,
        sectionId: { in: scopedSectionIds },
        submissionDueAt: {
          gte: todayStart.toDate(),
          lt: tomorrowStart.toDate(),
        },
        homeworkCompletions: { none: { userId: user.id } },
      },
      select: { id: true },
      orderBy: [{ submissionDueAt: "asc" }, { createdAt: "desc" }],
    }),
    basePrisma.exam.count({
      where: {
        sectionId: { in: scopedSectionIds },
        OR: [
          { examDate: null },
          { examDate: { gte: tomorrowStart.toDate() } },
          {
            AND: [
              {
                examDate: {
                  gte: todayStart.toDate(),
                  lt: tomorrowStart.toDate(),
                },
              },
              {
                OR: [
                  { endTime: null, startTime: null },
                  { endTime: { gte: nowHHmm } },
                  { endTime: null, startTime: { gte: nowHHmm } },
                ],
              },
            ],
          },
        ],
      },
    }),
  ]);

  return {
    user: { id: user.id, name: user.name, username: user.username },
    pendingHomeworksCount,
    highlightPendingHomeworks: Boolean(dueTodayHomework),
    examsCount,
    pendingTodosCount,
  };
}

export type CalendarTodoItem = {
  id: string;
  title: string;
  dueAt: string;
  priority: TodoPriority;
  content: string | null;
};

export type OverviewData = {
  user: { id: string; name: string | null; username: string | null };
  currentTermName: string;
  hasAnySelection: boolean;
  hasCurrentTermSelection: boolean;
  todaySessions: ReturnType<typeof filterSessionsByDay>;
  tomorrowSessions: ReturnType<typeof filterSessionsByDay>;
  weeklySessions: ReturnType<typeof selectWeeklySessions>;
  weekDays: ReturnType<typeof buildWeekDays>;
  timeSlots: ReturnType<typeof buildTimeSlots>;
  incompleteHomeworks: HomeworkWithSection[];
  dueToday: HomeworkWithSection[];
  dueWithin3Days: HomeworkWithSection[];
  calendarSessions: ReturnType<typeof filterSessionsByDay>[];
  calendarHomeworks: HomeworkWithSection[];
  calendarDays: dayjs.Dayjs[];
  weekDayFormatter: ReturnType<typeof createWeekDayFormatter>;
  referenceNow: dayjs.Dayjs;
  todayStart: dayjs.Dayjs;
  semesterStart: dayjs.Dayjs | null;
  semesterEnd: dayjs.Dayjs | null;
  semesterWeeks: dayjs.Dayjs[][];
  allSessions: SessionItem[];
  allExams: ExamItem[];
  semesterHomeworks: HomeworkWithSection[];
  semesterTodos: CalendarTodoItem[];
  calendarSemesterPicker: { id: number; nameCn: string }[];
  calendarSemesterNavList: { id: number; nameCn: string }[];
  activeCalendarSemesterId: number | null;
  defaultCalendarSemesterId: number | null;
  activeCalendarSemesterName: string | null;
  dashboardLinks: DashboardLinkSummary[];
  recommendedLinks: DashboardLinkSummary[];
  pinnedLinks: DashboardLinkSummary[];
  overviewLinks: DashboardLinkSummary[];
};

export async function getDashboardOverviewData(
  userId: string,
  options: OverviewDataOptions = {},
): Promise<OverviewData | null> {
  const locale = await getLocale();
  const localizedPrisma = getPrisma(locale);
  const referenceNow = options.referenceNow
    ? shanghaiDayjs(options.referenceNow)
    : shanghaiDayjs();
  const referenceDate = referenceNow.toDate();

  const [semesters, user] = await Promise.all([
    localizedPrisma.semester.findMany({
      select: {
        id: true,
        nameCn: true,
        startDate: true,
        endDate: true,
      },
      orderBy: { startDate: "asc" },
    }),
    options.user
      ? Promise.resolve(options.user)
      : basePrisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            name: true,
            username: true,
          },
        }),
  ]);

  if (!user) return null;

  const currentSemester = selectCurrentSemesterFromList(
    semesters,
    referenceDate,
  );

  const calendarSemesterFromUrlValid =
    options.calendarSemesterId != null &&
    semesters.some((semester) => semester.id === options.calendarSemesterId);
  const gridSemesterRow =
    calendarSemesterFromUrlValid && options.calendarSemesterId != null
      ? (semesters.find(
          (semester) => semester.id === options.calendarSemesterId,
        ) ?? null)
      : currentSemester &&
          semesters.some((semester) => semester.id === currentSemester.id)
        ? (semesters.find((semester) => semester.id === currentSemester.id) ??
          null)
        : null;

  const fallbackStart = referenceNow.subtract(6, "month").toDate();
  const fallbackEnd = referenceNow.add(6, "month").toDate();
  const candidateStarts = [
    currentSemester?.startDate,
    gridSemesterRow?.startDate,
  ].filter((date): date is Date => date != null);
  const candidateEnds = [
    currentSemester?.endDate,
    gridSemesterRow?.endDate,
  ].filter((date): date is Date => date != null);
  const scheduleDateStart =
    candidateStarts.length > 0
      ? new Date(Math.min(...candidateStarts.map((date) => date.getTime())))
      : fallbackStart;
  const scheduleDateEnd =
    candidateEnds.length > 0
      ? new Date(Math.max(...candidateEnds.map((date) => date.getTime())))
      : fallbackEnd;

  const allSections = await listSubscribedDashboardSections(userId, {
    locale,
    dateFrom: scheduleDateStart,
    dateTo: scheduleDateEnd,
    sectionIds: options.sectionIds,
  });
  const {
    hasAnySelection,
    hasCurrentTermSelection,
    dashboardSections,
    dashboardSectionIds,
  } = resolveDashboardSections(allSections, currentSemester);
  const currentTermName = currentSemester?.nameCn ?? "—";

  const subscribedSemesterIds = new Set(
    allSections
      .map((section) => section.semester?.id)
      .filter((id): id is number => id != null),
  );
  const calendarSemesterPicker = semesters
    .filter((semester) => subscribedSemesterIds.has(semester.id))
    .sort(
      (left, right) =>
        shanghaiDayjs(left.startDate).valueOf() -
        shanghaiDayjs(right.startDate).valueOf(),
    )
    .map((semester) => ({ id: semester.id, nameCn: semester.nameCn ?? "—" }));

  const calendarSemesterNavList = semesters.map((semester) => ({
    id: semester.id,
    nameCn: semester.nameCn ?? "—",
  }));

  const sectionsForCalendarGrid = gridSemesterRow
    ? allSections.filter(
        (section) => section.semester?.id === gridSemesterRow.id,
      )
    : [];

  const homeworkSectionIds =
    calendarSemesterFromUrlValid && options.calendarSemesterId != null
      ? sectionsForCalendarGrid.length > 0
        ? sectionsForCalendarGrid.map((section) => section.id)
        : []
      : dashboardSectionIds;

  const linksPromise = options.skipLinks
    ? Promise.resolve({
        dashboardLinks: [],
        recommendedLinks: [],
        pinnedLinks: [],
        overviewLinks: [],
      })
    : getSignedInDashboardLinksData(userId);

  const sessions = sortSessionsByStart(buildSessions(dashboardSections));
  const now = referenceNow;
  const todayStart = now.startOf("day");
  const tomorrowStart = todayStart.add(1, "day");
  const { start: weekStart, endExclusive: weekEnd } = getDefaultWeekRange(now);

  const homeworks: HomeworkWithSection[] = await listSubscribedHomeworks(
    userId,
    {
      locale,
      completed: false,
      sectionIds: homeworkSectionIds,
      shape: "dashboard",
    },
  );
  const todaySessions = filterSessionsByDay(sessions, todayStart);
  const tomorrowSessions = filterSessionsByDay(sessions, tomorrowStart);
  const weeklySessions = selectWeeklySessions(sessions, weekStart, weekEnd);
  const weekDays = buildWeekDays(weekStart);
  const timeSlots = buildTimeSlots(weeklySessions);
  const { incompleteHomeworks, dueToday, dueWithin3Days } =
    computeHomeworkBuckets(homeworks, todayStart);
  const weekDayFormatter = createWeekDayFormatter(locale);

  const calendarStart = todayStart.subtract(3, "day");
  const calendarEnd = todayStart.add(4, "day");
  const calendarDays = Array.from({ length: 7 }, (_, index) =>
    calendarStart.add(index, "day"),
  );
  const calendarSessions = calendarDays.map((day) =>
    filterSessionsByDay(sessions, day),
  );
  const calendarHomeworks = incompleteHomeworks.filter((homework) => {
    if (!homework.submissionDueAt) return false;
    const due = shanghaiDayjs(homework.submissionDueAt);
    return !due.isBefore(calendarStart) && due.isBefore(calendarEnd);
  });

  const semesterStart =
    gridSemesterRow?.startDate != null
      ? shanghaiDayjs(gridSemesterRow.startDate).startOf("day")
      : null;
  const semesterEnd =
    gridSemesterRow?.endDate != null
      ? shanghaiDayjs(gridSemesterRow.endDate).endOf("day")
      : null;
  const semesterWeeks =
    semesterStart && semesterEnd && !semesterStart.isAfter(semesterEnd)
      ? getSemesterWeeks(semesterStart, semesterEnd)
      : [];
  const allSessions = sortSessionsByStart(
    buildSessions(sectionsForCalendarGrid),
  );
  const allExams = buildExams(sectionsForCalendarGrid);
  const semesterHomeworks =
    semesterStart && semesterEnd
      ? incompleteHomeworks.filter((homework) => {
          if (!homework.submissionDueAt) return false;
          const due = shanghaiDayjs(homework.submissionDueAt);
          return (
            !due.isBefore(semesterStart, "day") &&
            !due.isAfter(semesterEnd, "day")
          );
        })
      : [];

  const semesterTodoRowsPromise =
    semesterStart && semesterEnd
      ? basePrisma.todo.findMany({
          where: {
            userId,
            completed: false,
            dueAt: {
              not: null,
              gte: semesterStart.toDate(),
              lte: semesterEnd.endOf("day").toDate(),
            },
          },
          orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
          select: {
            id: true,
            title: true,
            dueAt: true,
            priority: true,
            content: true,
          },
        })
      : Promise.resolve([]);

  const [
    semesterTodoRows,
    { dashboardLinks, recommendedLinks, pinnedLinks, overviewLinks },
  ] = await Promise.all([semesterTodoRowsPromise, linksPromise]);

  const semesterTodos: CalendarTodoItem[] = semesterTodoRows.flatMap((row) =>
    row.dueAt
      ? [
          {
            id: row.id,
            title: row.title,
            dueAt: toShanghaiIsoString(row.dueAt),
            priority: row.priority,
            content: row.content ?? null,
          },
        ]
      : [],
  );

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
    todaySessions,
    tomorrowSessions,
    weeklySessions,
    weekDays,
    timeSlots,
    incompleteHomeworks,
    dueToday,
    dueWithin3Days,
    calendarSessions,
    calendarHomeworks,
    calendarDays,
    weekDayFormatter,
    referenceNow: now,
    todayStart,
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
