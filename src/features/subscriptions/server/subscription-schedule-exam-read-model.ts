import {
  scheduleTeacherContextSelect,
  sectionCatalogInclude,
} from "@/features/catalog/server/academic-query-includes";
import type { Prisma } from "@/generated/prisma/client";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { getPrisma, prisma } from "@/lib/db/prisma";
import { paginatedQuery } from "@/lib/query-pagination";
import { parseDateInput } from "@/lib/time/parse-date-input";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import { formatShanghaiDate } from "@/lib/time/shanghai-format";
import {
  overviewExamSelect,
  overviewScheduleSelect,
} from "./subscription-overview-selects";
import {
  getSubscribedSectionIds,
  getSubscribedSectionIdsForSemester,
  withSubscribedSections,
} from "./subscription-read-model-shared";

const subscribedScheduleInclude = {
  room: {
    include: {
      building: { include: { campus: true } },
      roomType: true,
    },
  },
  teachers: { select: scheduleTeacherContextSelect },
  section: { include: sectionCatalogInclude },
  scheduleGroup: true,
} satisfies Prisma.ScheduleInclude;

const subscribedExamInclude = {
  examBatch: true,
  examRooms: true,
  section: { include: sectionCatalogInclude },
} satisfies Prisma.ExamInclude;

const subscribedScheduleOrderBy = [
  { date: "asc" },
  { startTime: "asc" },
] satisfies Prisma.ScheduleOrderByWithRelationInput[];

const subscribedExamOrderBy = [
  { examDate: "asc" },
  { startTime: "asc" },
  { jwId: "asc" },
] satisfies Prisma.ExamOrderByWithRelationInput[];

function dateRangeFilter(dateFrom?: Date, dateTo?: Date) {
  return dateFrom || dateTo
    ? {
        ...(dateFrom ? { gte: dateFrom } : {}),
        ...(dateTo ? { lte: dateTo } : {}),
      }
    : undefined;
}

function examDateWhere(input: {
  dateFrom?: Date;
  dateTo?: Date;
  includeDateUnknown: boolean;
}) {
  const range = dateRangeFilter(input.dateFrom, input.dateTo);
  if (range) {
    return {
      OR: [
        { examDate: range },
        ...(input.includeDateUnknown ? [{ examDate: null }] : []),
      ],
    };
  }
  return input.includeDateUnknown ? {} : { examDate: { not: null } };
}

function upcomingKnownExamWhere(input: {
  atTime: Date;
  sectionIds: readonly number[];
}) {
  const referenceNow = shanghaiDayjs(input.atTime);
  const todayStart = parseDateInput(formatShanghaiDate(input.atTime));
  if (!(todayStart instanceof Date)) {
    throw new Error("Failed to derive exam date cutoff");
  }
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const nowHHmm = referenceNow.hour() * 100 + referenceNow.minute();
  const sectionIds = Array.from(input.sectionIds);

  return {
    sectionId: { in: sectionIds },
    section: { retiredAt: null },
    OR: [
      { examDate: { gte: tomorrowStart } },
      {
        AND: [
          { examDate: { gte: todayStart, lt: tomorrowStart } },
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
  };
}

export async function listSubscribedSchedules(
  userId: string,
  {
    locale = DEFAULT_LOCALE,
    dateFrom,
    dateTo,
    weekday,
    limit,
    sectionIds,
    semesterId,
  }: {
    locale?: string;
    dateFrom?: Date;
    dateTo?: Date;
    weekday?: number;
    limit?: number;
    sectionIds?: readonly number[];
    semesterId?: number;
  } = {},
) {
  const resolvedSectionIds =
    semesterId !== undefined
      ? await getSubscribedSectionIdsForSemester(userId, semesterId)
      : sectionIds;

  return withSubscribedSections(
    userId,
    async (ids) => {
      const localizedPrisma = getPrisma(locale);
      const dateFilter = dateRangeFilter(dateFrom, dateTo);
      const query = {
        where: {
          sectionId: { in: ids },
          section: { retiredAt: null },
          ...(dateFilter ? { date: dateFilter } : {}),
          ...(weekday ? { weekday } : {}),
        },
        orderBy: subscribedScheduleOrderBy,
        ...(limit ? { take: limit } : {}),
      } satisfies Prisma.ScheduleFindManyArgs;

      return localizedPrisma.schedule.findMany({
        ...query,
        include: subscribedScheduleInclude,
      });
    },
    resolvedSectionIds,
  );
}

export async function listSubscribedSchedulePage(
  userId: string,
  {
    locale = DEFAULT_LOCALE,
    dateFrom,
    dateTo,
    weekday,
    semesterId,
    pagination,
  }: {
    locale?: string;
    dateFrom?: Date;
    dateTo?: Date;
    weekday?: number;
    semesterId?: number;
    pagination: {
      page: number;
      pageSize: number;
    };
  },
) {
  const sectionIds =
    semesterId !== undefined
      ? await getSubscribedSectionIdsForSemester(userId, semesterId)
      : await getSubscribedSectionIds(userId);
  const localizedPrisma = getPrisma(locale);
  const dateFilter = dateRangeFilter(dateFrom, dateTo);
  const where = {
    sectionId: { in: sectionIds },
    section: { retiredAt: null },
    ...(dateFilter ? { date: dateFilter } : {}),
    ...(weekday ? { weekday } : {}),
  } satisfies Prisma.ScheduleWhereInput;

  return paginatedQuery(
    (skip, take) =>
      localizedPrisma.schedule.findMany({
        where,
        include: subscribedScheduleInclude,
        orderBy: subscribedScheduleOrderBy,
        skip,
        take,
      }),
    () => localizedPrisma.schedule.count({ where }),
    pagination.page,
    pagination.pageSize,
  );
}

export async function countUpcomingSubscribedExams({
  atTime,
  sectionIds,
}: {
  atTime: Date;
  sectionIds: readonly number[];
}) {
  if (sectionIds.length === 0) return 0;
  return prisma.exam.count({
    where: upcomingKnownExamWhere({ atTime, sectionIds }),
  });
}

export async function listTodaySubscribedSchedulesWithCount(
  userId: string,
  {
    todayStart,
    tomorrowStart,
    includeItems = true,
    locale = DEFAULT_LOCALE,
    limit,
    sectionIds,
  }: {
    todayStart: Date;
    tomorrowStart: Date;
    includeItems?: boolean;
    locale?: string;
    limit?: number;
    sectionIds?: readonly number[];
  },
) {
  return withSubscribedSections(
    userId,
    async (ids) => {
      const where = {
        sectionId: { in: ids },
        section: { retiredAt: null },
        date: { gte: todayStart, lt: tomorrowStart },
      } satisfies Prisma.ScheduleWhereInput;
      const localizedPrisma = getPrisma(locale);
      const total = await localizedPrisma.schedule.count({ where });
      const items = includeItems
        ? await localizedPrisma.schedule.findMany({
            where,
            select: overviewScheduleSelect,
            orderBy: subscribedScheduleOrderBy,
            ...(limit ? { take: limit } : {}),
          })
        : [];
      return { total, items };
    },
    sectionIds,
    { total: 0, items: [] },
  );
}

export async function listUpcomingSubscribedExamsWithCount(
  userId: string,
  {
    atTime,
    includeItems = true,
    locale = DEFAULT_LOCALE,
    limit,
    sectionIds,
  }: {
    atTime: Date;
    includeItems?: boolean;
    locale?: string;
    limit?: number;
    sectionIds?: readonly number[];
  },
) {
  return withSubscribedSections(
    userId,
    async (ids) => {
      const where = upcomingKnownExamWhere({ atTime, sectionIds: ids });
      const total = await countUpcomingSubscribedExams({
        atTime,
        sectionIds: ids,
      });
      const items = includeItems
        ? await getPrisma(locale).exam.findMany({
            where,
            select: overviewExamSelect,
            orderBy: subscribedExamOrderBy,
            ...(limit ? { take: limit } : {}),
          })
        : [];
      return { total, items };
    },
    sectionIds,
    { total: 0, items: [] },
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
    semesterId,
  }: {
    locale?: string;
    dateFrom?: Date;
    dateTo?: Date;
    includeDateUnknown?: boolean;
    limit?: number;
    sectionIds?: readonly number[];
    semesterId?: number;
  } = {},
) {
  const resolvedSectionIds =
    semesterId !== undefined
      ? await getSubscribedSectionIdsForSemester(userId, semesterId)
      : sectionIds;

  return withSubscribedSections(
    userId,
    async (ids) => {
      const localizedPrisma = getPrisma(locale);
      return localizedPrisma.exam.findMany({
        where: {
          sectionId: { in: ids },
          section: { retiredAt: null },
          ...examDateWhere({ dateFrom, dateTo, includeDateUnknown }),
        },
        include: subscribedExamInclude,
        orderBy: subscribedExamOrderBy,
        ...(limit ? { take: limit } : {}),
      });
    },
    resolvedSectionIds,
  );
}

export async function listSubscribedExamPage(
  userId: string,
  {
    locale = DEFAULT_LOCALE,
    dateFrom,
    dateTo,
    includeDateUnknown = true,
    semesterId,
    pagination,
  }: {
    locale?: string;
    dateFrom?: Date;
    dateTo?: Date;
    includeDateUnknown?: boolean;
    semesterId?: number;
    pagination: {
      page: number;
      pageSize: number;
    };
  },
) {
  const sectionIds =
    semesterId !== undefined
      ? await getSubscribedSectionIdsForSemester(userId, semesterId)
      : await getSubscribedSectionIds(userId);
  const localizedPrisma = getPrisma(locale);
  const where = {
    sectionId: { in: sectionIds },
    section: { retiredAt: null },
    ...examDateWhere({ dateFrom, dateTo, includeDateUnknown }),
  } satisfies Prisma.ExamWhereInput;

  return paginatedQuery(
    (skip, take) =>
      localizedPrisma.exam.findMany({
        where,
        include: subscribedExamInclude,
        orderBy: subscribedExamOrderBy,
        skip,
        take,
      }),
    () => localizedPrisma.exam.count({ where }),
    pagination.page,
    pagination.pageSize,
  );
}
