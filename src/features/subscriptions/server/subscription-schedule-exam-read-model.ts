import { DEFAULT_LOCALE } from "@/i18n/config";
import { getPrisma, prisma } from "@/lib/db/prisma";
import { parseDateInput } from "@/lib/time/parse-date-input";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import { formatShanghaiDate } from "@/lib/time/shanghai-format";
import { withSubscribedSections } from "./subscription-read-model-shared";

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
      const dateFilter = dateRangeFilter(dateFrom, dateTo);

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
          ...examDateWhere({ dateFrom, dateTo, includeDateUnknown }),
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
