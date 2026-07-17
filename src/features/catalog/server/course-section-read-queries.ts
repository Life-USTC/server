import {
  courseDetailInclude,
  courseInclude,
  sectionCatalogInclude,
  sectionCompactInclude,
  sectionInclude,
} from "@/features/catalog/server/academic-query-includes";
import type { AppLocale } from "@/i18n/config";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { getPrisma } from "@/lib/db/prisma";
import { serializeScheduleTimeFields } from "@/shared/lib/schedule-serialization";
import { resolveCourseIdByJwId } from "./course-jw-id";

const sectionDetailInclude = {
  ...sectionInclude,
  roomType: true,
  schedules: true,
  scheduleGroups: true,
  teachers: {
    include: {
      department: true,
      teacherTitle: true,
    },
  },
  teacherAssignments: {
    include: {
      teacher: true,
      teacherLessonType: true,
    },
  },
  exams: {
    include: {
      examBatch: true,
      examRooms: true,
    },
  },
} as const;

export async function findCourseDetailByJwId(
  jwId: number,
  locale: AppLocale = DEFAULT_LOCALE,
) {
  const prisma = getPrisma(locale);
  const courseId = await resolveCourseIdByJwId(prisma, jwId);
  if (courseId == null) return null;
  return prisma.course.findUnique({
    where: { id: courseId },
    include: courseDetailInclude,
  });
}

export async function findCoursesByJwIds(
  jwIds: readonly number[],
  locale: AppLocale = DEFAULT_LOCALE,
) {
  const prisma = getPrisma(locale);
  const requestedJwIds = [...new Set(jwIds)];
  const [courses, aliases] = await Promise.all([
    prisma.course.findMany({
      where: { jwId: { in: requestedJwIds } },
      include: courseInclude,
    }),
    prisma.courseAlias.findMany({
      where: { jwId: { in: requestedJwIds } },
      include: {
        course: {
          include: courseInclude,
        },
      },
    }),
  ]);
  const byJwId = new Map(courses.map((course) => [course.jwId, course]));
  for (const alias of aliases) {
    if (byJwId.has(alias.jwId)) {
      throw new Error(
        `Course jwId namespace collision: ${alias.jwId} is both a Course and CourseAlias`,
      );
    }
    byJwId.set(alias.jwId, alias.course);
  }
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
) {
  const section = await getPrisma(locale).section.findUnique({
    where: { jwId },
    include: sectionDetailInclude,
  });

  if (!section) return null;

  return {
    ...section,
    schedules: section.schedules.map(serializeScheduleTimeFields),
  };
}

export async function findSectionsByJwIds(
  jwIds: readonly number[],
  locale: AppLocale = DEFAULT_LOCALE,
) {
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
