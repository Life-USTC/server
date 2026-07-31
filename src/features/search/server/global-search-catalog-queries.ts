import { buildCourseListWhere } from "@/features/catalog/server/course-query-filters";
import { buildSectionListQuery } from "@/features/catalog/server/section-query-filters";
import { SECTION_SUMMARY_DEFAULT_ORDER_BY } from "@/features/catalog/server/section-summary-read-model";
import { buildTeacherWhere } from "@/features/catalog/server/teacher-query";
import type { AppLocale } from "@/i18n/config";
import { getPrisma } from "@/lib/db/prisma";

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
  const { orderBy, where } = buildSectionListQuery({ search: query });
  return getPrisma(locale).section.findMany({
    where,
    orderBy: orderBy ?? SECTION_SUMMARY_DEFAULT_ORDER_BY,
    select: {
      code: true,
      jwId: true,
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
