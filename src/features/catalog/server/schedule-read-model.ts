import {
  buildScheduleDateWhere,
  buildScheduleListWhere,
  type ScheduleListFilters,
} from "@/features/catalog/lib/schedule-filters";
import {
  scheduleTeacherSelect,
  sectionPublicContextSelect,
} from "@/features/catalog/server/academic-query-includes";
import type { Prisma } from "@/generated/prisma/client";
import type { AppLocale } from "@/i18n/config";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { getPrisma } from "@/lib/db/prisma";
import { paginatedQuery } from "@/lib/query-pagination";
import {
  serializeScheduleGroupTimeFields,
  serializeScheduleTimeFields,
} from "@/shared/lib/schedule-serialization";
import { cachedCatalogListRead } from "./catalog-list-cache";

export const publicScheduleInclude = {
  room: {
    include: {
      building: {
        include: {
          campus: true,
        },
      },
      roomType: true,
    },
  },
  teachers: {
    select: scheduleTeacherSelect,
  },
  section: {
    include: {
      course: true,
      semester: true,
    },
  },
  scheduleGroup: true,
} as const satisfies Prisma.ScheduleInclude;

export type PublicScheduleRecord = Prisma.ScheduleGetPayload<{
  include: typeof publicScheduleInclude;
}>;

export const sectionScheduleInclude = {
  room: {
    include: {
      building: {
        include: {
          campus: true,
        },
      },
      roomType: true,
    },
  },
  teachers: {
    select: scheduleTeacherSelect,
  },
  scheduleGroup: true,
} as const satisfies Prisma.ScheduleInclude;

export type SectionScheduleRecord = Prisma.ScheduleGetPayload<{
  include: typeof sectionScheduleInclude;
}>;

export const sectionScheduleListInclude = {
  ...sectionScheduleInclude,
  section: {
    include: {
      course: true,
    },
  },
} as const satisfies Prisma.ScheduleInclude;

export async function listPublicSchedules(input: {
  filters: ScheduleListFilters;
  locale?: AppLocale;
  page: number;
  pageSize?: number;
}) {
  const locale = input.locale ?? DEFAULT_LOCALE;
  return cachedCatalogListRead({
    filters: input.filters,
    kind: "schedules",
    locale,
    pagination: { page: input.page, pageSize: input.pageSize ?? 20 },
    shape: "catalog",
    load: async () => {
      const prisma = getPrisma(locale);
      const where = buildScheduleListWhere(input.filters, {
        excludeRetiredSections: true,
      });
      const result = await paginatedQuery(
        (skip, take) =>
          prisma.schedule.findMany({
            where,
            skip,
            take,
            include: publicScheduleInclude,
            orderBy: [{ date: "asc" }, { startTime: "asc" }],
          }),
        () => prisma.schedule.count({ where }),
        input.page,
        input.pageSize,
      );

      return {
        ...result,
        data: result.data.map(serializeScheduleTimeFields),
      };
    },
  });
}

export async function getSectionSchedulesByJwId(input: {
  dateFrom?: Date;
  dateTo?: Date;
  includeSection?: boolean;
  limit?: number;
  locale?: AppLocale;
  sectionJwId: number;
}) {
  const sectionWithSchedules = await getPrisma(
    input.locale ?? DEFAULT_LOCALE,
  ).section.findUnique({
    where: { jwId: input.sectionJwId },
    select: {
      ...sectionPublicContextSelect,
      schedules: {
        where: buildScheduleDateWhere(input),
        include: input.includeSection
          ? sectionScheduleListInclude
          : sectionScheduleInclude,
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
        ...(input.limit !== undefined && { take: input.limit }),
      },
    },
  });

  if (!sectionWithSchedules) return { found: false as const };

  const { schedules: rawSchedules, ...section } = sectionWithSchedules;
  const schedules = rawSchedules.map(serializeScheduleTimeFields);

  return { found: true as const, section, schedules };
}

export async function getSectionScheduleGroupsByJwId(input: {
  locale?: AppLocale;
  sectionJwId: number;
}) {
  const section = await getPrisma(
    input.locale ?? DEFAULT_LOCALE,
  ).section.findUnique({
    where: { jwId: input.sectionJwId },
    include: {
      scheduleGroups: {
        include: { schedules: true },
        orderBy: [{ isDefault: "desc" }, { no: "asc" }],
      },
    },
  });

  if (!section) return { found: false as const };

  return {
    found: true as const,
    scheduleGroups: section.scheduleGroups.map(
      serializeScheduleGroupTimeFields,
    ),
  };
}
