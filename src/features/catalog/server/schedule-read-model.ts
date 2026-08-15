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
import type { SectionPublicContextDto } from "@/lib/api/schemas/academic-section-list-response-schemas";
import {
  type ScheduleEntryDto,
  type SectionScheduleEntryDto,
  type SectionScheduleWithContextDto,
  scheduleEntrySchema,
  sectionScheduleEntrySchema,
  sectionScheduleWithContextSchema,
} from "@/lib/api/schemas/schedule-response-schema-core";
import { getPrisma } from "@/lib/db/prisma";
import { paginatedQuery } from "@/lib/query-pagination";
import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";
import { serializeScheduleGroupTimeFields } from "@/shared/lib/schedule-serialization";
import { toSectionPublicContextDto } from "./academic-summary-dto-mappers";
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

function localizedName(
  input: {
    nameCn: string;
    nameEn: string | null;
  },
  locale: AppLocale,
) {
  const nameEn = input.nameEn?.trim() || null;
  return {
    nameCn: input.nameCn,
    nameEn: input.nameEn,
    namePrimary: locale === "en-us" && nameEn ? nameEn : input.nameCn,
    nameSecondary: locale === "en-us" ? (nameEn ? input.nameCn : null) : nameEn,
  };
}

function toScheduleBaseDto(
  input: PublicScheduleRecord | SectionScheduleRecord,
) {
  return {
    id: input.id,
    periods: input.periods,
    date: input.date ? toShanghaiIsoString(input.date) : null,
    weekday: input.weekday,
    startTime: String(input.startTime)
      .padStart(4, "0")
      .replace(/(\d{2})(\d{2})/, "$1:$2"),
    endTime: String(input.endTime)
      .padStart(4, "0")
      .replace(/(\d{2})(\d{2})/, "$1:$2"),
    experiment: input.experiment,
    customPlace: input.customPlace,
    lessonType: input.lessonType,
    weekIndex: input.weekIndex,
    exerciseClass: input.exerciseClass,
    startUnit: input.startUnit,
    endUnit: input.endUnit,
    roomId: input.roomId,
    sectionId: input.sectionId,
    scheduleGroupId: input.scheduleGroupId,
  };
}

function toScheduleRoomDto(
  input: NonNullable<PublicScheduleRecord["room"]>,
  locale: AppLocale,
) {
  return {
    id: input.id,
    jwId: input.jwId,
    ...localizedName(input, locale),
    code: input.code,
    floor: input.floor,
    virtual: input.virtual,
    seatsForSection: input.seatsForSection,
    remark: input.remark,
    seats: input.seats,
    buildingId: input.buildingId,
    roomTypeId: input.roomTypeId,
    building: input.building
      ? {
          id: input.building.id,
          jwId: input.building.jwId,
          ...localizedName(input.building, locale),
          code: input.building.code,
          campusId: input.building.campusId,
          campus: input.building.campus
            ? {
                id: input.building.campus.id,
                jwId: input.building.campus.jwId,
                ...localizedName(input.building.campus, locale),
                code: input.building.campus.code,
              }
            : null,
        }
      : null,
    roomType: input.roomType
      ? {
          id: input.roomType.id,
          jwId: input.roomType.jwId,
          ...localizedName(input.roomType, locale),
          code: input.roomType.code,
        }
      : null,
  };
}

function toScheduleTeacherDto(
  input: PublicScheduleRecord["teachers"][number],
  locale: AppLocale,
) {
  return {
    id: input.id,
    jwId: input.jwId,
    personId: input.personId,
    code: input.code,
    ...localizedName(input, locale),
    department: input.department
      ? {
          id: input.department.id,
          code: input.department.code,
          isCollege: input.department.isCollege,
          ...localizedName(input.department, locale),
        }
      : null,
  };
}

function toScheduleGroupDto(input: PublicScheduleRecord["scheduleGroup"]) {
  return {
    id: input.id,
    jwId: input.jwId,
    no: input.no,
    limitCount: input.limitCount,
    stdCount: input.stdCount,
    actualPeriods: input.actualPeriods,
    isDefault: input.isDefault,
    sectionId: input.sectionId,
  };
}

export function toScheduleEntryDto(
  input: PublicScheduleRecord,
  locale: AppLocale,
): ScheduleEntryDto {
  return scheduleEntrySchema.parse({
    ...toScheduleBaseDto(input),
    room: input.room ? toScheduleRoomDto(input.room, locale) : null,
    teachers: input.teachers.map((teacher) =>
      toScheduleTeacherDto(teacher, locale),
    ),
    section: {
      id: input.section.id,
      jwId: input.section.jwId,
      retiredAt: input.section.retiredAt
        ? toShanghaiIsoString(input.section.retiredAt)
        : null,
      code: input.section.code,
      bizTypeId: input.section.bizTypeId,
      credits: input.section.credits,
      period: input.section.period,
      periodsPerWeek: input.section.periodsPerWeek,
      timesPerWeek: input.section.timesPerWeek,
      stdCount: input.section.stdCount,
      limitCount: input.section.limitCount,
      graduateAndPostgraduate: input.section.graduateAndPostgraduate,
      dateTimePlaceText: input.section.dateTimePlaceText,
      dateTimePlacePersonText: input.section.dateTimePlacePersonText,
      actualPeriods: input.section.actualPeriods,
      theoryPeriods: input.section.theoryPeriods,
      practicePeriods: input.section.practicePeriods,
      experimentPeriods: input.section.experimentPeriods,
      machinePeriods: input.section.machinePeriods,
      designPeriods: input.section.designPeriods,
      testPeriods: input.section.testPeriods,
      scheduleState: input.section.scheduleState,
      suggestScheduleWeeks: input.section.suggestScheduleWeeks,
      suggestScheduleWeekInfo: input.section.suggestScheduleWeekInfo,
      scheduleJsonParams: input.section.scheduleJsonParams,
      selectedStdCount: input.section.selectedStdCount,
      remark: input.section.remark,
      scheduleRemark: input.section.scheduleRemark,
      courseId: input.section.courseId,
      semesterId: input.section.semesterId,
      campusId: input.section.campusId,
      examModeId: input.section.examModeId,
      openDepartmentId: input.section.openDepartmentId,
      teachLanguageId: input.section.teachLanguageId,
      roomTypeId: input.section.roomTypeId,
      course: {
        id: input.section.course.id,
        jwId: input.section.course.jwId,
        code: input.section.course.code,
        ...localizedName(input.section.course, locale),
        categoryId: input.section.course.categoryId,
        classTypeId: input.section.course.classTypeId,
        classifyId: input.section.course.classifyId,
        educationLevelId: input.section.course.educationLevelId,
        gradationId: input.section.course.gradationId,
        typeId: input.section.course.typeId,
      },
      semester: input.section.semester
        ? {
            id: input.section.semester.id,
            jwId: input.section.semester.jwId,
            nameCn: input.section.semester.nameCn,
            code: input.section.semester.code,
            startDate: input.section.semester.startDate
              ? toShanghaiIsoString(input.section.semester.startDate)
              : null,
            endDate: input.section.semester.endDate
              ? toShanghaiIsoString(input.section.semester.endDate)
              : null,
          }
        : null,
    },
    scheduleGroup: toScheduleGroupDto(input.scheduleGroup),
  });
}

export function toSectionScheduleEntryDto(
  input: SectionScheduleRecord,
  locale: AppLocale,
): SectionScheduleEntryDto {
  return sectionScheduleEntrySchema.parse({
    ...toScheduleBaseDto(input),
    room: input.room ? toScheduleRoomDto(input.room, locale) : null,
    teachers: input.teachers.map((teacher) =>
      toScheduleTeacherDto(teacher, locale),
    ),
    scheduleGroup: toScheduleGroupDto(input.scheduleGroup),
  });
}

export function toSectionScheduleWithContextDto(
  input: SectionScheduleRecord,
  section: SectionPublicContextDto,
  locale: AppLocale,
): SectionScheduleWithContextDto {
  return sectionScheduleWithContextSchema.parse({
    ...toSectionScheduleEntryDto(input, locale),
    section,
  });
}

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
        data: result.data.map((schedule) =>
          toScheduleEntryDto(schedule, locale),
        ),
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

  const { schedules: rawSchedules, ...rawSection } = sectionWithSchedules;
  const section = toSectionPublicContextDto(
    rawSection,
    input.locale ?? DEFAULT_LOCALE,
  );
  const schedules = (rawSchedules as SectionScheduleRecord[]).map((schedule) =>
    input.includeSection
      ? toSectionScheduleWithContextDto(
          schedule,
          section,
          input.locale ?? DEFAULT_LOCALE,
        )
      : toSectionScheduleEntryDto(schedule, input.locale ?? DEFAULT_LOCALE),
  );

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
