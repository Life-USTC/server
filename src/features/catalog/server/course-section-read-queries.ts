import {
  courseDetailInclude,
  courseInclude,
  sectionCatalogInclude,
  sectionCompactInclude,
  sectionInclude,
  teacherAssignmentPublicSelect,
  teacherPublicReferenceSelect,
} from "@/features/catalog/server/academic-query-includes";
import type { Prisma } from "@/generated/prisma/client";
import type { AppLocale } from "@/i18n/config";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { cachedPublicDetailRuntimeData } from "@/lib/catalog-detail-runtime-cache";
import { getPrisma } from "@/lib/db/prisma";
import { serializeScheduleTimeFields } from "@/shared/lib/schedule-serialization";

const sectionDetailInclude = {
  ...sectionInclude,
  roomType: true,
  schedules: true,
  scheduleGroups: true,
  teachers: { select: teacherPublicReferenceSelect },
  teacherAssignments: { select: teacherAssignmentPublicSelect },
  exams: {
    include: {
      examBatch: true,
      examRooms: true,
    },
  },
} as const satisfies Prisma.SectionInclude;

export type SectionDetailRecord = Prisma.SectionGetPayload<{
  include: typeof sectionDetailInclude;
}>;

export async function findCourseDetailByJwId(
  jwId: number,
  locale: AppLocale = DEFAULT_LOCALE,
) {
  return cachedPublicDetailRuntimeData({
    id: jwId,
    kind: "course",
    locale,
    shape: "detail-v1",
    load: () =>
      getPrisma(locale).course.findUnique({
        where: { jwId },
        include: courseDetailInclude,
      }),
  });
}

export async function findCoursesByJwIds(
  jwIds: readonly number[],
  locale: AppLocale = DEFAULT_LOCALE,
) {
  if (jwIds.length === 1) {
    return [await findCourseDetailByJwId(jwIds[0], locale)];
  }

  const prisma = getPrisma(locale);
  const requestedJwIds = [...new Set(jwIds)];
  const courses = await prisma.course.findMany({
    where: { jwId: { in: requestedJwIds } },
    include: courseInclude,
  });
  const byJwId = new Map(courses.map((course) => [course.jwId, course]));
  return jwIds.map((jwId) => byJwId.get(jwId) ?? null);
}

export async function findSectionByJwId(
  jwId: number,
  locale: AppLocale = DEFAULT_LOCALE,
) {
  return getPrisma(locale).section.findUnique({
    where: { jwId },
    include: sectionInclude,
  });
}

export async function findSectionDetailByJwId(
  jwId: number,
  locale: AppLocale = DEFAULT_LOCALE,
  options?: {
    includeExams?: boolean;
    includeSchedules?: boolean;
    includeTeacherDepartments?: boolean;
  },
) {
  const hasPartialFlags =
    options != null &&
    (options.includeExams !== undefined ||
      options.includeSchedules !== undefined ||
      options.includeTeacherDepartments !== undefined);

  const include = hasPartialFlags
    ? buildPartialSectionDetailInclude(options)
    : sectionDetailInclude;

  const shape = hasPartialFlags
    ? `detail-v1:exams=${options.includeExams === true}:schedules=${options.includeSchedules === true}:teacher-departments=${options.includeTeacherDepartments === true}`
    : "detail-v1:full";

  return cachedPublicDetailRuntimeData({
    id: jwId,
    kind: "section",
    locale,
    shape,
    load: async () => {
      const section = await getPrisma(locale).section.findUnique({
        where: { jwId },
        include,
      });

      if (!section) return null;

      return {
        ...section,
        exams: "exams" in section && section.exams ? section.exams : [],
        scheduleGroups:
          "scheduleGroups" in section && section.scheduleGroups
            ? section.scheduleGroups
            : [],
        schedules:
          "schedules" in section && section.schedules
            ? section.schedules.map(serializeScheduleTimeFields)
            : [],
        teacherAssignments:
          "teacherAssignments" in section && section.teacherAssignments
            ? section.teacherAssignments
            : [],
        teachers: section.teachers ?? [],
      };
    },
  });
}

function buildPartialSectionDetailInclude(options: {
  includeExams?: boolean;
  includeSchedules?: boolean;
  includeTeacherDepartments?: boolean;
}) {
  const includeExams = options.includeExams === true;
  const includeSchedules = options.includeSchedules === true;
  return {
    ...sectionInclude,
    roomType: true,
    schedules: includeSchedules,
    scheduleGroups: includeSchedules,
    teachers: { select: teacherPublicReferenceSelect },
    teacherAssignments:
      options.includeTeacherDepartments === true
        ? { select: teacherAssignmentPublicSelect }
        : false,
    exams: includeExams
      ? {
          include: {
            examBatch: true,
            examRooms: true,
          },
        }
      : false,
  } as const;
}

export async function findSectionsByJwIds(
  jwIds: readonly number[],
  locale: AppLocale = DEFAULT_LOCALE,
) {
  if (jwIds.length === 1) {
    return [
      await findSectionDetailByJwId(jwIds[0], locale, {
        includeExams: false,
        includeSchedules: false,
        includeTeacherDepartments: false,
      }),
    ];
  }

  const sections = await getPrisma(locale).section.findMany({
    where: { jwId: { in: [...new Set(jwIds)] } },
    include: sectionCatalogInclude,
  });
  const byJwId = new Map(sections.map((section) => [section.jwId, section]));
  return jwIds.map((jwId) => byJwId.get(jwId) ?? null);
}

export async function findSectionCompactByJwId(
  jwId: number,
  locale: AppLocale = DEFAULT_LOCALE,
) {
  return getPrisma(locale).section.findUnique({
    where: { jwId },
    include: sectionCompactInclude,
  });
}

export function findSectionSummaryByJwId(
  jwId: number,
  locale: AppLocale = DEFAULT_LOCALE,
) {
  return getPrisma(locale).section.findUnique({
    where: { jwId },
    select: {
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
    },
  });
}
