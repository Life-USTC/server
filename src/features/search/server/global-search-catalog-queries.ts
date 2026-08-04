import { buildCourseListWhere } from "@/features/catalog/server/course-query-filters";
import { SECTION_SUMMARY_DEFAULT_ORDER_BY } from "@/features/catalog/server/section-summary-read-model";
import { buildTeacherWhere } from "@/features/catalog/server/teacher-query";
import type { Prisma } from "@/generated/prisma/client";
import type { AppLocale } from "@/i18n/config";
import { getPrisma } from "@/lib/db/prisma";
import { ilike } from "@/lib/query-filter-helpers";

function buildGlobalSectionSearchWhere(
  query: string,
): Prisma.SectionWhereInput {
  return {
    retiredAt: null,
    OR: [
      { course: { nameCn: ilike(query) } },
      { course: { nameEn: ilike(query) } },
      { course: { code: ilike(query) } },
      { code: ilike(query) },
    ],
  };
}

export async function searchCoursesForGlobal(
  query: string,
  locale: AppLocale,
  limit: number,
) {
  return getPrisma(locale).course.findMany({
    where: buildCourseListWhere({ search: query }),
    orderBy: [{ code: "asc" }, { jwId: "asc" }],
    select: {
      code: true,
      jwId: true,
      nameCn: true,
      namePrimary: true,
    },
    take: limit,
  });
}

export async function searchSectionsForGlobal(
  query: string,
  locale: AppLocale,
  limit: number,
) {
  return getPrisma(locale).section.findMany({
    where: buildGlobalSectionSearchWhere(query),
    orderBy: SECTION_SUMMARY_DEFAULT_ORDER_BY,
    select: {
      code: true,
      jwId: true,
      campus: {
        select: {
          nameCn: true,
          namePrimary: true,
        },
      },
      course: {
        select: {
          code: true,
          nameCn: true,
          namePrimary: true,
        },
      },
      semester: {
        select: {
          nameCn: true,
        },
      },
      teachers: {
        select: {
          nameCn: true,
          namePrimary: true,
        },
        orderBy: { nameCn: "asc" },
        take: 4,
      },
    },
    take: limit,
  });
}

export async function searchTeachersForGlobal(
  query: string,
  locale: AppLocale,
  limit: number,
) {
  return getPrisma(locale).teacher.findMany({
    where: buildTeacherWhere({ search: query }),
    orderBy: { nameCn: "asc" },
    select: {
      code: true,
      id: true,
      nameCn: true,
      department: {
        select: {
          nameCn: true,
        },
      },
    },
    take: limit,
  });
}
