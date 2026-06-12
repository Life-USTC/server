import { DEFAULT_LOCALE } from "@/i18n/config";
import { getPrisma } from "@/lib/db/prisma";
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
