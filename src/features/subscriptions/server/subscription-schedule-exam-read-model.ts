import {
  scheduleTeacherContextSelect,
  sectionCatalogInclude,
} from "@/features/catalog/server/academic-query-includes";
import { buildScheduleEntryDto } from "@/features/catalog/server/schedule-read-model";
import type { Prisma } from "@/generated/prisma/client";
import type { AppLocale } from "@/i18n/config";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { subscribedScheduleEntrySchema } from "@/lib/api/schemas/schedule-response-schema-core";
import { getPrisma, prisma } from "@/lib/db/prisma";
import { toLocalizedNameDto } from "@/lib/localized-name";
import { buildPaginatedResponse, normalizePagination } from "@/lib/pagination";
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

/**
 * Viewer-scoped reads run inside RLS transactions, which Hyperdrive's query
 * cache never stores, so every `include` edge is an uncached round trip on
 * every request. Compact calendar consumers omit `Section.examMode`,
 * `Section.teachLanguage` and the six `Course` lookup relations.
 * `campus` and `openDepartment` stay: `compactSection` emits both.
 *
 * REST and MCP schedule DTOs also publish only Course scalars. The MCP exam
 * list and full calendar payloads publish all eight labels, so those callers
 * explicitly request `"full"`.
 */
const subscribedSectionContextInclude = {
  course: true,
  semester: true,
  campus: true,
  openDepartment: true,
} satisfies Prisma.SectionInclude;

export type SubscribedSectionContext = "compact" | "full";

const subscribedScheduleInclude = {
  room: {
    include: {
      building: { include: { campus: true } },
      roomType: true,
    },
  },
  teacherParticipations: {
    select: {
      periods: true,
      exerciseClass: true,
      teacher: { select: scheduleTeacherContextSelect },
    },
    orderBy: { teacherId: "asc" },
  },
  section: { include: subscribedSectionContextInclude },
  scheduleGroup: true,
} satisfies Prisma.ScheduleInclude;

/**
 * GraphQL resolves `Section.examMode/teachLanguage` and
 * `Course.category/classify/classType/educationLevel/gradation/type` from the
 * parent payload with the default field resolver (`src/lib/graphql/schema.ts`
 * declares them and no `Section`/`Course` resolver overrides them), so the
 * paginated readers that back `Workspace.schedules`/`Workspace.exams` keep the
 * full catalog include.
 */
const subscribedSchedulePageInclude = {
  ...subscribedScheduleInclude,
  section: { include: sectionCatalogInclude },
} satisfies Prisma.ScheduleInclude;

const restScheduleInclude = {
  ...subscribedScheduleInclude,
  section: { include: { course: true, semester: true } },
} satisfies Prisma.ScheduleInclude;

type RestScheduleRecord = Prisma.ScheduleGetPayload<{
  include: typeof restScheduleInclude;
}>;

export type SubscribedScheduleRecord = Prisma.ScheduleGetPayload<{
  include: typeof subscribedScheduleInclude;
}>;

export function buildSubscribedScheduleEntryDto(
  input: RestScheduleRecord,
  locale: AppLocale,
) {
  const schedule = buildScheduleEntryDto(input, locale);
  const teachers = schedule.teachers.map((teacher, index) => {
    const source = input.teacherParticipations[index].teacher;
    return {
      ...teacher,
      teacherTitle: source.teacherTitle
        ? {
            id: source.teacherTitle.id,
            jwId: source.teacherTitle.jwId,
            code: source.teacherTitle.code,
            enabled: source.teacherTitle.enabled,
            ...toLocalizedNameDto(source.teacherTitle, locale),
          }
        : null,
      _count: { sections: source._count.sections },
    };
  });
  return {
    ...schedule,
    teachers,
    teacherParticipations: schedule.teacherParticipations.map(
      (participation, index) => ({
        ...participation,
        teacher: teachers[index],
      }),
    ),
  };
}

export function toSubscribedScheduleEntryDto(
  input: SubscribedScheduleRecord,
  locale: AppLocale,
) {
  return subscribedScheduleEntrySchema.parse(
    buildSubscribedScheduleEntryDto(input, locale),
  );
}

const subscribedExamInclude = {
  examBatch: true,
  examRooms: true,
  section: { include: subscribedSectionContextInclude },
} satisfies Prisma.ExamInclude;

const subscribedExamPageInclude = {
  ...subscribedExamInclude,
  section: { include: sectionCatalogInclude },
} satisfies Prisma.ExamInclude;

function subscribedExamContextInclude(context: SubscribedSectionContext) {
  return context === "full" ? subscribedExamPageInclude : subscribedExamInclude;
}

const subscribedScheduleOrderBy = [
  { date: "asc" },
  { startTime: "asc" },
  { id: "asc" },
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

function minuteToScheduleTime(minute: number) {
  return Math.floor(minute / 60) * 100 + (minute % 60);
}

type ScheduleListOptions = {
  locale?: string;
  dateFrom?: Date;
  dateTo?: Date;
  weekday?: number;
  startMinuteFrom?: number;
  startMinuteTo?: number;
  limit?: number;
  sectionIds?: readonly number[];
  semesterId?: number;
};

export function listSubscribedSchedules(
  userId: string,
  options: ScheduleListOptions & { sectionContext: "rest" },
): Promise<RestScheduleRecord[]>;
export function listSubscribedSchedules(
  userId: string,
  options?: ScheduleListOptions & { sectionContext?: SubscribedSectionContext },
): Promise<SubscribedScheduleRecord[]>;
export async function listSubscribedSchedules(
  userId: string,
  {
    locale = DEFAULT_LOCALE,
    dateFrom,
    dateTo,
    weekday,
    startMinuteFrom,
    startMinuteTo,
    limit,
    sectionIds,
    semesterId,
    sectionContext = "compact",
  }: ScheduleListOptions & {
    sectionContext?: SubscribedSectionContext | "rest";
  } = {},
): Promise<RestScheduleRecord[] | SubscribedScheduleRecord[]> {
  const resolvedSectionIds =
    semesterId !== undefined
      ? await getSubscribedSectionIdsForSemester(userId, semesterId)
      : sectionIds;

  return withSubscribedSections(
    userId,
    async (ids) => {
      const localizedPrisma = getPrisma(locale);
      const dateFilter = dateRangeFilter(dateFrom, dateTo);
      const hasStartWindow =
        startMinuteFrom !== undefined || startMinuteTo !== undefined;
      const query = {
        where: {
          sectionId: { in: ids },
          section: { retiredAt: null },
          ...(dateFilter ? { date: dateFilter } : {}),
          ...(hasStartWindow
            ? {
                startTime: {
                  ...(startMinuteFrom !== undefined
                    ? { gte: minuteToScheduleTime(startMinuteFrom) }
                    : {}),
                  ...(startMinuteTo !== undefined
                    ? { lte: minuteToScheduleTime(startMinuteTo) }
                    : {}),
                },
              }
            : {}),
          ...(weekday ? { weekday } : {}),
        },
        orderBy: subscribedScheduleOrderBy,
        ...(limit ? { take: limit } : {}),
      } satisfies Prisma.ScheduleFindManyArgs;

      if (hasStartWindow) {
        // Prisma issues relation queries even when the schedule query returns no rows.
        const first = await localizedPrisma.schedule.findFirst({
          where: query.where,
          select: { id: true },
        });
        if (!first) return [];
      }

      if (sectionContext === "rest") {
        return localizedPrisma.schedule.findMany({
          ...query,
          include: restScheduleInclude,
        });
      }
      return localizedPrisma.schedule.findMany({
        ...query,
        include:
          sectionContext === "full"
            ? subscribedSchedulePageInclude
            : subscribedScheduleInclude,
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
        include: subscribedSchedulePageInclude,
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
      const [total, items] = await Promise.all([
        localizedPrisma.schedule.count({ where }),
        includeItems
          ? localizedPrisma.schedule.findMany({
              where,
              select: overviewScheduleSelect,
              orderBy: subscribedScheduleOrderBy,
              ...(limit ? { take: limit } : {}),
            })
          : Promise.resolve([]),
      ]);
      return {
        total,
        items: items.map((item) => ({
          ...item,
          teachers: item.teacherParticipations.map(({ teacher }) => teacher),
        })),
      };
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
      const localizedPrisma = getPrisma(locale);
      const [total, items] = await Promise.all([
        localizedPrisma.exam.count({ where }),
        includeItems
          ? localizedPrisma.exam.findMany({
              where,
              select: overviewExamSelect,
              orderBy: subscribedExamOrderBy,
              ...(limit ? { take: limit } : {}),
            })
          : Promise.resolve([]),
      ]);
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
    sectionContext = "compact",
  }: {
    locale?: string;
    dateFrom?: Date;
    dateTo?: Date;
    includeDateUnknown?: boolean;
    limit?: number;
    sectionIds?: readonly number[];
    semesterId?: number;
    sectionContext?: SubscribedSectionContext;
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
        include: subscribedExamContextInclude(sectionContext),
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
    includeCatalogRelations = true,
  }: {
    locale?: string;
    includeCatalogRelations?: boolean;
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
  if (!sectionIds.length) {
    const { page, pageSize } = normalizePagination(pagination);
    return buildPaginatedResponse([], page, pageSize, 0);
  }
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
        include: includeCatalogRelations
          ? subscribedExamPageInclude
          : {
              examBatch: true,
              examRooms: true,
              section: { include: { course: true, semester: true } },
            },
        orderBy: subscribedExamOrderBy,
        skip,
        take,
      }),
    () => localizedPrisma.exam.count({ where }),
    pagination.page,
    pagination.pageSize,
    { inferShortFirstPageTotal: true },
  );
}
