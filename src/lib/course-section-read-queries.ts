import { buildCourseListWhere } from "@/lib/course-section-query-filters";
import { getPrisma } from "@/lib/db/prisma";
import {
  courseDetailInclude,
  courseInclude,
  sectionCompactInclude,
  sectionInclude,
} from "@/lib/query-helpers";

export async function listCoursesBySearch(
  search: string,
  limit: number,
  locale = "zh-cn",
) {
  const localizedPrisma = getPrisma(locale);

  return localizedPrisma.course.findMany({
    where: buildCourseListWhere({ search }),
    include: courseInclude,
    orderBy: [{ code: "asc" }, { jwId: "asc" }],
    take: limit,
  });
}

export async function findCourseDetailByJwId(jwId: number, locale = "zh-cn") {
  return getPrisma(locale).course.findUnique({
    where: { jwId },
    include: courseDetailInclude,
  });
}

export async function findSectionByJwId(jwId: number, locale = "zh-cn") {
  return getPrisma(locale).section.findUnique({
    where: { jwId },
    include: sectionInclude,
  });
}

export async function findSectionDetailByJwId(jwId: number, locale = "zh-cn") {
  return getPrisma(locale).section.findUnique({
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
}

export async function findSectionCompactByJwId(jwId: number, locale = "zh-cn") {
  return getPrisma(locale).section.findUnique({
    where: { jwId },
    include: sectionCompactInclude,
  });
}
