import {
  courseDetailInclude,
  sectionCompactInclude,
  sectionInclude,
} from "@/features/catalog/server/academic-query-includes";
import type { AppLocale } from "@/i18n/config";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { getPrisma } from "@/lib/db/prisma";
import { serializeScheduleTimeFields } from "@/shared/lib/schedule-serialization";

export async function findCourseDetailByJwId(
  jwId: number,
  locale: AppLocale = DEFAULT_LOCALE,
) {
  return getPrisma(locale).course.findUnique({
    where: { jwId },
    include: courseDetailInclude,
  });
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
    include: {
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
    },
  });

  if (!section) return null;

  return {
    ...section,
    schedules: section.schedules.map(serializeScheduleTimeFields),
  };
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
