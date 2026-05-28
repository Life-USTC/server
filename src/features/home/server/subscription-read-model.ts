import type { Prisma } from "@/generated/prisma/client";
import { DEFAULT_LOCALE } from "@/i18n/config";
import {
  buildUserCalendarFeedPath,
  ensureUserCalendarFeedToken,
} from "@/lib/calendar-feed-token";
import { selectCurrentSemesterFromList } from "@/lib/current-semester";
import { getPrisma, prisma } from "@/lib/db/prisma";
import { sectionCompactInclude } from "@/lib/query-helpers";
import { getPublicOrigin } from "@/lib/site-url";
import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";
import type {
  HomeworkWithSection,
  SectionWithRelations,
} from "./dashboard-types";

export const SECTION_SUBSCRIPTION_NOTE =
  "Life@USTC section subscriptions only affect your dashboard and calendar here. They are not official USTC course enrollment.";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

const userSectionSubscriptionSelect = {
  id: true,
  calendarFeedToken: true,
  subscribedSections: { select: { id: true, jwId: true } },
} satisfies Prisma.UserSelect;

type ListSubscribedHomeworksOptions = {
  locale?: string;
  completed?: boolean;
  includeDeleted?: boolean;
  includeEditors?: boolean;
  limit?: number;
  dueAtFrom?: Date;
  dueAtTo?: Date;
  requireDueDate?: boolean;
  sectionIds?: readonly number[];
  shape?: "full" | "dashboard";
};

type SubscribedHomeworkBaseRecord = Prisma.HomeworkGetPayload<{
  include: {
    section: { include: { course: true; semester: true } };
    description: true;
    homeworkCompletions: { select: { completedAt: true } };
  };
}>;

type SubscribedHomeworkSection = NonNullable<
  SubscribedHomeworkBaseRecord["section"]
>;

type SubscribedHomeworkRecord = Omit<
  SubscribedHomeworkBaseRecord,
  "section"
> & {
  section:
    | (Omit<SubscribedHomeworkSection, "course"> & {
        course:
          | (SubscribedHomeworkSection["course"] & {
              namePrimary: string | null;
            })
          | null;
      })
    | null;
};

export interface UserSectionSubscriptionState {
  userId: string;
  subscriptionIcsUrl: string;
  subscribedSections: number[];
}

export type HomeworkSummaryItem = {
  id: string;
  title: string;
  isMajor: boolean;
  requiresTeam: boolean;
  publishedAt: string | null;
  submissionStartAt: string | null;
  submissionDueAt: string | null;
  createdAt: string;
  description: string | null;
  completion: { completedAt: string } | null;
  section: {
    jwId: number | null;
    code: string | null;
    courseName: string | null;
    semesterName: string | null;
  } | null;
};

export type SectionOption = {
  id: number;
  jwId: number | null;
  code: string | null;
  courseName: string | null;
  semesterName: string | null;
  semesterStart: string | null;
  semesterEnd: string | null;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Resolve subscribed section IDs for a user.
 * If `sectionIds` is provided, use those directly (for MCP tools
 * that already have scoped IDs). Otherwise fetch from the DB.
 */
async function resolveSubscribedSectionIds(
  userId: string,
  sectionIds?: readonly number[],
) {
  return sectionIds
    ? Array.from(sectionIds)
    : await getSubscribedSectionIds(userId);
}

/**
 * Run `fn(sectionIds)` only when the user has subscribed sections.
 * Returns `fallback` (default `[]`) when no sections found.
 * Eliminates the repeated "resolve → early return if empty" pattern.
 */
async function withSubscribedSections<T>(
  userId: string,
  fn: (ids: number[]) => Promise<T>,
  sectionIds?: readonly number[],
  fallback: T = [] as T,
): Promise<T> {
  const ids = await resolveSubscribedSectionIds(userId, sectionIds);
  if (ids.length === 0) return fallback;
  return fn(ids);
}

async function buildCalendarFeedPath(
  userId: string,
  calendarFeedToken: string | null,
) {
  const token =
    calendarFeedToken ?? (await ensureUserCalendarFeedToken(userId));
  return buildUserCalendarFeedPath(userId, token);
}

function sectionOptionFromRow(row: {
  id: number;
  jwId: number | null;
  code: string | null;
  course: { namePrimary: string | null } | null;
  semester: {
    nameCn: string | null;
    startDate: Date | null;
    endDate: Date | null;
  } | null;
}) {
  return {
    id: row.id,
    jwId: row.jwId,
    code: row.code,
    courseName: row.course?.namePrimary ?? null,
    semesterName: row.semester?.nameCn ?? null,
    semesterStart: row.semester?.startDate
      ? toShanghaiIsoString(row.semester.startDate)
      : null,
    semesterEnd: row.semester?.endDate
      ? toShanghaiIsoString(row.semester.endDate)
      : null,
  };
}

/* ------------------------------------------------------------------ */
/*  Public queries                                                     */
/* ------------------------------------------------------------------ */

export async function getSubscribedSectionIds(
  userId: string,
): Promise<number[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscribedSections: { select: { id: true } } },
  });
  return user?.subscribedSections.map((s) => s.id) ?? [];
}

export async function getUserSectionSubscriptionState(
  userId: string,
): Promise<UserSectionSubscriptionState | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: userSectionSubscriptionSelect,
  });
  if (!user) return null;

  return {
    userId: user.id,
    subscriptionIcsUrl: await buildCalendarFeedPath(
      user.id,
      user.calendarFeedToken,
    ),
    subscribedSections: user.subscribedSections.map(({ id }) => id),
  };
}

export async function getUserCalendarSubscription(
  userId: string,
  locale = DEFAULT_LOCALE,
) {
  const localizedPrisma = getPrisma(locale);
  const user = await localizedPrisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      calendarFeedToken: true,
      subscribedSections: {
        include: sectionCompactInclude,
        orderBy: [{ semester: { jwId: "desc" } }, { code: "asc" }],
      },
    },
  });

  if (!user) return null;

  const calendarPath = await buildCalendarFeedPath(
    user.id,
    user.calendarFeedToken,
  );
  return {
    userId: user.id,
    sections: user.subscribedSections,
    calendarPath,
    calendarUrl: `${getPublicOrigin()}${calendarPath}`,
    note: SECTION_SUBSCRIPTION_NOTE,
  };
}

export async function getCalendarSubscriptionUrl(
  userId: string,
  calendarFeedToken?: string | null,
) {
  if (calendarFeedToken !== undefined) {
    return buildCalendarFeedPath(userId, calendarFeedToken);
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, calendarFeedToken: true },
  });
  if (!user) return null;
  return buildCalendarFeedPath(user.id, user.calendarFeedToken);
}

/* ------------------------------------------------------------------ */
/*  Section & homework listings                                        */
/* ------------------------------------------------------------------ */

async function listSubscribedSectionOptions(
  userId: string,
  locale = DEFAULT_LOCALE,
): Promise<SectionOption[]> {
  return withSubscribedSections(
    userId,
    async (ids) => {
      const sections = await getPrisma(locale).section.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          jwId: true,
          code: true,
          course: { select: { namePrimary: true } },
          semester: {
            select: { nameCn: true, startDate: true, endDate: true },
          },
        },
        orderBy: [{ semester: { jwId: "desc" } }, { code: "asc" }],
      });
      return sections.map(sectionOptionFromRow);
    },
    undefined,
  );
}

export async function getHomeworksTabData(
  userId: string,
  locale = DEFAULT_LOCALE,
) {
  const [sections, homeworks] = await Promise.all([
    listSubscribedSectionOptions(userId, locale),
    listSubscribedHomeworks(userId, { locale }),
  ]);

  const homeworkSummaries: HomeworkSummaryItem[] = homeworks.map((hw) => ({
    id: hw.id,
    title: hw.title,
    isMajor: hw.isMajor,
    requiresTeam: hw.requiresTeam,
    publishedAt: hw.publishedAt ? toShanghaiIsoString(hw.publishedAt) : null,
    submissionStartAt: hw.submissionStartAt
      ? toShanghaiIsoString(hw.submissionStartAt)
      : null,
    submissionDueAt: hw.submissionDueAt
      ? toShanghaiIsoString(hw.submissionDueAt)
      : null,
    createdAt: toShanghaiIsoString(hw.createdAt),
    description: hw.description?.content ?? null,
    completion: hw.homeworkCompletions[0]
      ? {
          completedAt: toShanghaiIsoString(
            hw.homeworkCompletions[0].completedAt,
          ),
        }
      : null,
    section: hw.section
      ? {
          jwId: hw.section.jwId ?? null,
          code: hw.section.code ?? null,
          courseName: hw.section.course?.namePrimary ?? null,
          semesterName: hw.section.semester?.nameCn ?? null,
        }
      : null,
  }));

  return { homeworkSummaries, sections };
}

async function listSubscribedSectionsForSubscriptionsTab(
  userId: string,
  locale = DEFAULT_LOCALE,
) {
  return withSubscribedSections(
    userId,
    async (ids) => {
      return getPrisma(locale).section.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          jwId: true,
          code: true,
          credits: true,
          course: { select: { namePrimary: true } },
          semester: { select: { id: true, nameCn: true, startDate: true } },
          teachers: { select: { namePrimary: true } },
          exams: {
            select: {
              id: true,
              examDate: true,
              startTime: true,
              endTime: true,
              examMode: true,
              examRooms: { select: { room: true, count: true } },
            },
            orderBy: [{ examDate: "asc" }],
          },
        },
        orderBy: [{ semester: { jwId: "desc" } }, { code: "asc" }],
      });
    },
    undefined,
  );
}

export async function getSubscriptionsTabData(
  userId: string,
  locale = DEFAULT_LOCALE,
) {
  const localizedPrisma = getPrisma(locale);
  const [sections, semesters, calendarSubscriptionUrl] = await Promise.all([
    listSubscribedSectionsForSubscriptionsTab(userId, locale),
    localizedPrisma.semester.findMany({
      select: { id: true, nameCn: true, startDate: true, endDate: true },
      orderBy: { startDate: "asc" },
    }),
    getCalendarSubscriptionUrl(userId),
  ]);

  return {
    subscriptions: sections.length > 0 ? [{ id: userId, sections }] : [],
    semesters,
    currentSemesterId:
      selectCurrentSemesterFromList(semesters, new Date())?.id ?? null,
    userId,
    calendarSubscriptionUrl,
  };
}

export type SubscriptionsTabData = Awaited<
  ReturnType<typeof getSubscriptionsTabData>
>;

export async function listSubscribedDashboardSections(
  userId: string,
  {
    locale = DEFAULT_LOCALE,
    dateFrom,
    dateTo,
    sectionIds,
  }: {
    locale?: string;
    dateFrom?: Date;
    dateTo?: Date;
    sectionIds?: readonly number[];
  } = {},
): Promise<SectionWithRelations[]> {
  return withSubscribedSections(
    userId,
    async (ids) => {
      const localizedPrisma = getPrisma(locale);

      const dateFilter =
        dateFrom || dateTo
          ? {
              ...(dateFrom ? { gte: dateFrom } : {}),
              ...(dateTo ? { lte: dateTo } : {}),
            }
          : undefined;

      const [sectionRows, scheduleRows, examRows] = await Promise.all([
        localizedPrisma.section.findMany({
          where: { id: { in: ids } },
          select: {
            id: true,
            jwId: true,
            course: { select: { namePrimary: true } },
            semester: { select: { id: true } },
          },
          orderBy: [{ semester: { jwId: "desc" } }, { code: "asc" }],
        }),
        localizedPrisma.schedule.findMany({
          where: {
            sectionId: { in: ids },
            ...(dateFilter ? { date: dateFilter } : {}),
          },
          select: {
            id: true,
            sectionId: true,
            date: true,
            startTime: true,
            endTime: true,
            customPlace: true,
            room: {
              select: {
                namePrimary: true,
                building: {
                  select: {
                    namePrimary: true,
                    campus: { select: { namePrimary: true } },
                  },
                },
              },
            },
            teachers: { select: { namePrimary: true } },
          },
          orderBy: [{ date: "asc" }, { startTime: "asc" }],
        }),
        localizedPrisma.exam.findMany({
          where: { sectionId: { in: ids } },
          select: {
            id: true,
            sectionId: true,
            examDate: true,
            startTime: true,
            endTime: true,
            examType: true,
            examTakeCount: true,
            examMode: true,
            examRooms: {
              select: { room: true, count: true },
              orderBy: { room: "asc" },
            },
          },
          orderBy: [{ examDate: "asc" }, { startTime: "asc" }, { jwId: "asc" }],
        }),
      ]);

      const schedulesBySectionId = groupByField(
        scheduleRows,
        "sectionId",
        (row) => ({
          id: row.id,
          date: row.date,
          startTime: row.startTime,
          endTime: row.endTime,
          customPlace: row.customPlace,
          room: row.room,
          teachers: row.teachers,
        }),
      );

      const examsBySectionId = groupByField(examRows, "sectionId", (row) => ({
        id: row.id,
        examDate: row.examDate,
        startTime: row.startTime,
        endTime: row.endTime,
        examType: row.examType,
        examTakeCount: row.examTakeCount,
        examMode: row.examMode,
        examRooms: row.examRooms ?? [],
      }));

      return sectionRows.map((section) => ({
        id: section.id,
        jwId: section.jwId,
        course: { namePrimary: section.course.namePrimary },
        semester: section.semester,
        schedules: schedulesBySectionId.get(section.id) ?? [],
        exams: examsBySectionId.get(section.id) ?? [],
      }));
    },
    sectionIds,
  );
}

/* ------------------------------------------------------------------ */
/*  Homework listings                                                  */
/* ------------------------------------------------------------------ */

function buildSubscribedHomeworkInclude(
  userId: string,
  includeEditors: boolean,
) {
  return {
    section: { include: { course: true, semester: true } },
    description: true,
    homeworkCompletions: {
      where: { userId },
      select: { completedAt: true },
    },
    ...(includeEditors
      ? {
          createdBy: {
            select: { id: true, name: true, username: true, image: true },
          },
          updatedBy: {
            select: { id: true, name: true, username: true, image: true },
          },
          deletedBy: {
            select: { id: true, name: true, username: true, image: true },
          },
        }
      : {}),
  } satisfies Prisma.HomeworkInclude;
}

function buildDashboardHomeworkSelect(userId: string) {
  return {
    id: true,
    title: true,
    submissionDueAt: true,
    description: { select: { content: true } },
    homeworkCompletions: { where: { userId }, select: { completedAt: true } },
    section: { select: { jwId: true, course: true } },
  } satisfies Prisma.HomeworkSelect;
}

export async function listSubscribedHomeworks(
  userId: string,
  options: ListSubscribedHomeworksOptions & { shape: "dashboard" },
): Promise<HomeworkWithSection[]>;
export async function listSubscribedHomeworks(
  userId: string,
  options?: ListSubscribedHomeworksOptions,
): Promise<SubscribedHomeworkRecord[]>;
export async function listSubscribedHomeworks(
  userId: string,
  {
    locale = DEFAULT_LOCALE,
    completed,
    includeDeleted = false,
    includeEditors = false,
    limit,
    dueAtFrom,
    dueAtTo,
    requireDueDate = false,
    sectionIds,
    shape = "full",
  }: ListSubscribedHomeworksOptions = {},
): Promise<HomeworkWithSection[] | SubscribedHomeworkRecord[]> {
  return withSubscribedSections(
    userId,
    async (ids) => {
      const localizedPrisma = getPrisma(locale);
      const query = {
        where: {
          sectionId: { in: ids },
          ...(includeDeleted ? {} : { deletedAt: null }),
          ...(completed === undefined
            ? {}
            : completed
              ? { homeworkCompletions: { some: { userId } } }
              : { homeworkCompletions: { none: { userId } } }),
          ...(requireDueDate ? { submissionDueAt: { not: null } } : {}),
          ...(dueAtFrom || dueAtTo
            ? {
                submissionDueAt: {
                  ...(requireDueDate ? { not: null } : {}),
                  ...(dueAtFrom ? { gte: dueAtFrom } : {}),
                  ...(dueAtTo ? { lte: dueAtTo } : {}),
                },
              }
            : {}),
        },
        orderBy: [{ submissionDueAt: "asc" }, { createdAt: "desc" }],
        ...(limit ? { take: limit } : {}),
      } satisfies Prisma.HomeworkFindManyArgs;

      if (shape === "dashboard") {
        return localizedPrisma.homework.findMany({
          ...query,
          select: buildDashboardHomeworkSelect(userId),
        }) as Promise<HomeworkWithSection[]>;
      }

      return localizedPrisma.homework.findMany({
        ...query,
        include: buildSubscribedHomeworkInclude(userId, includeEditors),
      });
    },
    sectionIds,
  );
}

export async function listSubscribedHomeworkAuditLogs(
  userId: string,
  limit = 50,
  sectionIds?: readonly number[],
) {
  return withSubscribedSections(
    userId,
    async (ids) => {
      return prisma.homeworkAuditLog.findMany({
        where: { sectionId: { in: ids } },
        include: {
          actor: {
            select: { id: true, name: true, username: true, image: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
    },
    sectionIds,
  );
}

/* ------------------------------------------------------------------ */
/*  Schedule & exam listings                                           */
/* ------------------------------------------------------------------ */

export async function listSubscribedSchedules(
  userId: string,
  {
    locale = DEFAULT_LOCALE,
    dateFrom,
    dateTo,
    weekday,
    limit,
    sectionIds,
  }: {
    locale?: string;
    dateFrom?: Date;
    dateTo?: Date;
    weekday?: number;
    limit?: number;
    sectionIds?: readonly number[];
  } = {},
) {
  return withSubscribedSections(
    userId,
    async (ids) => {
      const localizedPrisma = getPrisma(locale);
      const dateFilter =
        dateFrom || dateTo
          ? {
              ...(dateFrom ? { gte: dateFrom } : {}),
              ...(dateTo ? { lte: dateTo } : {}),
            }
          : undefined;

      return localizedPrisma.schedule.findMany({
        where: {
          sectionId: { in: ids },
          ...(dateFilter ? { date: dateFilter } : {}),
          ...(weekday ? { weekday } : {}),
        },
        include: {
          room: {
            include: {
              building: { include: { campus: true } },
              roomType: true,
            },
          },
          teachers: { include: { department: true } },
          section: { include: { course: true, semester: true } },
          scheduleGroup: true,
        },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
        ...(limit ? { take: limit } : {}),
      });
    },
    sectionIds,
  );
}

export async function listSubscribedExams(
  userId: string,
  {
    locale = DEFAULT_LOCALE,
    dateFrom,
    dateTo,
    includeDateUnknown = true,
    limit,
    sectionIds,
  }: {
    locale?: string;
    dateFrom?: Date;
    dateTo?: Date;
    includeDateUnknown?: boolean;
    limit?: number;
    sectionIds?: readonly number[];
  } = {},
) {
  return withSubscribedSections(
    userId,
    async (ids) => {
      const localizedPrisma = getPrisma(locale);
      return localizedPrisma.exam.findMany({
        where: {
          sectionId: { in: ids },
          ...(dateFrom || dateTo
            ? {
                OR: [
                  {
                    examDate: {
                      ...(dateFrom ? { gte: dateFrom } : {}),
                      ...(dateTo ? { lte: dateTo } : {}),
                    },
                  },
                  ...(includeDateUnknown ? [{ examDate: null }] : []),
                ],
              }
            : includeDateUnknown
              ? {}
              : { examDate: { not: null } }),
        },
        include: {
          examBatch: true,
          examRooms: true,
          section: { include: { course: true, semester: true } },
        },
        orderBy: [{ examDate: "asc" }, { startTime: "asc" }, { jwId: "asc" }],
        ...(limit ? { take: limit } : {}),
      });
    },
    sectionIds,
  );
}

/* ------------------------------------------------------------------ */
/*  Utility                                                            */
/* ------------------------------------------------------------------ */

function groupByField<T, K extends string, V>(
  items: T[],
  field: K,
  mapFn: (item: T) => V,
): Map<number, V[]> {
  const map = new Map<number, V[]>();
  for (const item of items) {
    const key = (item as Record<string, unknown>)[field] as number;
    const list = map.get(key) ?? [];
    list.push(mapFn(item));
    map.set(key, list);
  }
  return map;
}
