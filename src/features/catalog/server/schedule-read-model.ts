import {
  buildScheduleDateWhere,
  buildScheduleListWhere,
  type ScheduleListFilters,
} from "@/features/catalog/lib/schedule-filters";
import type { Prisma } from "@/generated/prisma/client";
import type { AppLocale } from "@/i18n/config";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { getPrisma } from "@/lib/db/prisma";
import { paginatedQuery } from "@/lib/query-pagination";
import {
  serializeScheduleGroupTimeFields,
  serializeScheduleTimeFields,
} from "@/shared/lib/schedule-serialization";

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
    include: {
      department: true,
    },
  },
  section: {
    include: {
      course: true,
      semester: true,
    },
  },
  scheduleGroup: true,
} as const satisfies Prisma.ScheduleInclude;

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
    include: {
      department: true,
    },
  },
  scheduleGroup: true,
} as const satisfies Prisma.ScheduleInclude;

export const sectionScheduleListInclude = {
  ...sectionScheduleInclude,
  section: {
    include: {
      course: true,
    },
  },
} as const satisfies Prisma.ScheduleInclude;

const sectionScheduleContextSelect = {
  id: true,
  jwId: true,
  code: true,
  course: {
    select: {
      jwId: true,
      code: true,
      nameCn: true,
      nameEn: true,
    },
  },
  semester: {
    select: {
      jwId: true,
      code: true,
      nameCn: true,
    },
  },
} as const satisfies Prisma.SectionSelect;

type SectionScheduleContext = Prisma.SectionGetPayload<{
  select: typeof sectionScheduleContextSelect;
}>;
type SectionSchedule = Prisma.ScheduleGetPayload<{
  include: typeof sectionScheduleInclude;
}>;
type SectionScheduleWithSection = Prisma.ScheduleGetPayload<{
  include: typeof sectionScheduleListInclude;
}>;
type SerializedSectionSchedule = ReturnType<
  typeof serializeScheduleTimeFields<SectionSchedule>
>;
type SerializedSectionScheduleWithSection = ReturnType<
  typeof serializeScheduleTimeFields<SectionScheduleWithSection>
>;

type SectionScheduleResult<TSchedule> =
  | {
      found: true;
      section: SectionScheduleContext;
      schedules: TSchedule[];
    }
  | { found: false };

export async function listPublicSchedules(input: {
  filters: ScheduleListFilters;
  locale?: AppLocale;
  page: number;
  pageSize?: number;
}) {
  const prisma = getPrisma(input.locale ?? DEFAULT_LOCALE);
  const where = buildScheduleListWhere(input.filters);
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
}

export async function findSectionScheduleContextByJwId(input: {
  locale?: AppLocale;
  sectionJwId: number;
}) {
  return getPrisma(input.locale ?? DEFAULT_LOCALE).section.findUnique({
    where: { jwId: input.sectionJwId },
    select: sectionScheduleContextSelect,
  });
}

export async function listSchedulesBySectionId(input: {
  dateFrom?: Date;
  dateTo?: Date;
  includeSection: true;
  limit?: number;
  locale?: AppLocale;
  sectionId: number;
}): Promise<SerializedSectionScheduleWithSection[]>;
export async function listSchedulesBySectionId(input: {
  dateFrom?: Date;
  dateTo?: Date;
  includeSection?: false;
  limit?: number;
  locale?: AppLocale;
  sectionId: number;
}): Promise<SerializedSectionSchedule[]>;
export async function listSchedulesBySectionId(input: {
  dateFrom?: Date;
  dateTo?: Date;
  includeSection?: boolean;
  limit?: number;
  locale?: AppLocale;
  sectionId: number;
}): Promise<
  SerializedSectionSchedule[] | SerializedSectionScheduleWithSection[]
> {
  const prisma = getPrisma(input.locale ?? DEFAULT_LOCALE);
  const where = {
    sectionId: input.sectionId,
    ...buildScheduleDateWhere(input),
  };

  if (input.includeSection) {
    const schedules = await prisma.schedule.findMany({
      where,
      include: sectionScheduleListInclude,
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      ...(input.limit !== undefined && { take: input.limit }),
    });

    return schedules.map(serializeScheduleTimeFields);
  }

  const schedules = await prisma.schedule.findMany({
    where,
    include: sectionScheduleInclude,
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    ...(input.limit !== undefined && { take: input.limit }),
  });

  return schedules.map(serializeScheduleTimeFields);
}

export async function getSectionSchedulesByJwId(input: {
  dateFrom?: Date;
  dateTo?: Date;
  includeSection: true;
  limit?: number;
  locale?: AppLocale;
  sectionJwId: number;
}): Promise<SectionScheduleResult<SerializedSectionScheduleWithSection>>;
export async function getSectionSchedulesByJwId(input: {
  dateFrom?: Date;
  dateTo?: Date;
  includeSection?: false;
  limit?: number;
  locale?: AppLocale;
  sectionJwId: number;
}): Promise<SectionScheduleResult<SerializedSectionSchedule>>;
export async function getSectionSchedulesByJwId(input: {
  dateFrom?: Date;
  dateTo?: Date;
  includeSection?: boolean;
  limit?: number;
  locale?: AppLocale;
  sectionJwId: number;
}): Promise<
  SectionScheduleResult<
    SerializedSectionSchedule | SerializedSectionScheduleWithSection
  >
> {
  const section = await findSectionScheduleContextByJwId(input);
  if (!section) return { found: false as const };

  if (input.includeSection) {
    const schedules = await listSchedulesBySectionId({
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      includeSection: true,
      limit: input.limit,
      locale: input.locale,
      sectionId: section.id,
    });

    return { found: true as const, section, schedules };
  }

  const schedules = await listSchedulesBySectionId({
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    limit: input.limit,
    locale: input.locale,
    sectionId: section.id,
  });

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
        select: { schedules: true },
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
