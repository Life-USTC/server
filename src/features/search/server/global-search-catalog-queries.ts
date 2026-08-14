import { SECTION_SUMMARY_DEFAULT_ORDER_BY } from "@/features/catalog/server/section-summary-read-model";
import type { Prisma } from "@/generated/prisma/client";
import type { AppLocale } from "@/i18n/config";
import { getPrisma } from "@/lib/db/prisma";
import { ilike } from "@/lib/query-filter-helpers";

function searchTerms(query: string) {
  return [...new Set(query.trim().split(/\s+/u).filter(Boolean))];
}

function buildGlobalCourseSearchWhere(
  query: string,
): Prisma.CourseWhereInput | undefined {
  const terms = searchTerms(query);
  return terms.length > 0
    ? {
        AND: terms.map((term) => ({
          OR: [
            { nameCn: ilike(term) },
            { nameEn: ilike(term) },
            { code: ilike(term) },
          ],
        })),
      }
    : undefined;
}

function buildGlobalSectionSearchWhere(
  query: string,
): Prisma.SectionWhereInput {
  return {
    retiredAt: null,
    AND: searchTerms(query).map((term) => ({
      OR: [
        { course: { nameCn: ilike(term) } },
        { course: { nameEn: ilike(term) } },
        { course: { code: ilike(term) } },
        { code: ilike(term) },
        {
          teachers: {
            some: {
              OR: [
                { nameCn: ilike(term) },
                { nameEn: ilike(term) },
                { code: ilike(term) },
              ],
            },
          },
        },
      ],
    })),
  };
}

function buildGlobalTeacherSearchWhere(
  query: string,
): Prisma.TeacherWhereInput | undefined {
  const terms = searchTerms(query);
  return terms.length > 0
    ? {
        AND: terms.map((term) => ({
          OR: [
            { nameCn: ilike(term) },
            { nameEn: ilike(term) },
            { code: ilike(term) },
          ],
        })),
      }
    : undefined;
}

export async function searchCoursesForGlobal(
  query: string,
  locale: AppLocale,
  limit: number,
) {
  return getPrisma(locale).course.findMany({
    where: buildGlobalCourseSearchWhere(query),
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
    where: buildGlobalTeacherSearchWhere(query),
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
