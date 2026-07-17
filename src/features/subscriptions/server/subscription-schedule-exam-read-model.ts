import {
  sectionCatalogInclude,
  teacherListInclude,
} from "@/features/catalog/server/academic-query-includes";
import type { Prisma } from "@/generated/prisma/client";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { getPrisma, prisma } from "@/lib/db/prisma";
import { paginatedQuery } from "@/lib/query-pagination";
import { parseDateInput } from "@/lib/time/parse-date-input";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import { formatShanghaiDate } from "@/lib/time/shanghai-format";
import {
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
  teachers: { include: teacherListInclude },
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

      return localizedPrisma.schedule.findMany({
        where: {
          sectionId: { in: ids },
          ...(dateFilter ? { date: dateFilter } : {}),
          ...(weekday ? { weekday } : {}),
        },
        include: subscribedScheduleInclude,
        orderBy: subscribedScheduleOrderBy,
        ...(limit ? { take: limit } : {}),
      });
    },
    resolvedSectionIds,
  );
}

export function listSubscribedSchedulePage(
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
  const localizedPrisma = getPrisma(locale);
  const dateFilter = dateRangeFilter(dateFrom, dateTo);
  const where = {
    section: {
      subscribedUsers: { some: { id: userId } },
      ...(semesterId !== undefined ? { semesterId } : {}),
    },
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

export function listSubscribedExamPage(
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
  const localizedPrisma = getPrisma(locale);
  const where = {
    section: {
      subscribedUsers: { some: { id: userId } },
      ...(semesterId !== undefined ? { semesterId } : {}),
    },
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

export async function listUpcomingSubscribedExams(
  userId: string,
  {
    atTime,
    locale = DEFAULT_LOCALE,
    limit,
    sectionIds,
  }: {
    atTime: Date;
    locale?: string;
    limit?: number;
    sectionIds?: readonly number[];
  },
) {
  return withSubscribedSections(
    userId,
    async (ids) => {
      const localizedPrisma = getPrisma(locale);
      return localizedPrisma.exam.findMany({
        where: upcomingKnownExamWhere({ atTime, sectionIds: ids }),
        include: subscribedExamInclude,
        orderBy: subscribedExamOrderBy,
        ...(limit ? { take: limit } : {}),
      });
    },
    sectionIds,
  );
}
