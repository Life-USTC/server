import type { Prisma } from "@/generated/prisma/client";
import {
  courseInclude,
  sectionCompactInclude,
  sectionInclude,
  sectionSummarySelect,
  teacherListInclude,
} from "@/lib/academic-query-includes";
import { getPrisma } from "@/lib/db/prisma";
import { paginatedQuery } from "@/lib/query-pagination";

export function paginatedSectionQuery(
  page: number,
  pageSize?: number,
  where?: Prisma.SectionWhereInput,
  orderBy?:
    | Prisma.SectionOrderByWithRelationInput
    | Prisma.SectionOrderByWithRelationInput[],
  locale = "zh-cn",
) {
  const prisma = getPrisma(locale);
  return paginatedQuery(
    (skip, take) =>
      prisma.section.findMany({
        where,
        skip,
        take,
        include: sectionInclude,
        orderBy,
      }),
    () => prisma.section.count({ where }),
    page,
    pageSize,
  );
}

export function paginatedSectionCompactQuery(
  page: number,
  pageSize?: number,
  where?: Prisma.SectionWhereInput,
  orderBy?:
    | Prisma.SectionOrderByWithRelationInput
    | Prisma.SectionOrderByWithRelationInput[],
  locale = "zh-cn",
) {
  const prisma = getPrisma(locale);
  return paginatedQuery(
    (skip, take) =>
      prisma.section.findMany({
        where,
        skip,
        take,
        include: sectionCompactInclude,
        orderBy,
      }),
    () => prisma.section.count({ where }),
    page,
    pageSize,
  );
}

export function paginatedSectionSummaryQuery(
  page: number,
  pageSize?: number,
  where?: Prisma.SectionWhereInput,
  orderBy?:
    | Prisma.SectionOrderByWithRelationInput
    | Prisma.SectionOrderByWithRelationInput[],
  locale = "zh-cn",
) {
  const prisma = getPrisma(locale);
  return paginatedQuery(
    (skip, take) =>
      prisma.section.findMany({
        where,
        skip,
        take,
        select: sectionSummarySelect,
        orderBy,
      }),
    () => prisma.section.count({ where }),
    page,
    pageSize,
  );
}

export function paginatedCourseQuery(
  page: number,
  pageSize?: number,
  where?: Prisma.CourseWhereInput,
  orderBy?:
    | Prisma.CourseOrderByWithRelationInput
    | Prisma.CourseOrderByWithRelationInput[],
  locale = "zh-cn",
) {
  const prisma = getPrisma(locale);
  return paginatedQuery(
    (skip, take) =>
      prisma.course.findMany({
        where,
        skip,
        take,
        include: courseInclude,
        orderBy,
      }),
    () => prisma.course.count({ where }),
    page,
    pageSize,
  );
}

export function paginatedTeacherQuery(
  page: number,
  pageSize?: number,
  where?: Prisma.TeacherWhereInput,
  orderBy?:
    | Prisma.TeacherOrderByWithRelationInput
    | Prisma.TeacherOrderByWithRelationInput[],
  locale = "zh-cn",
) {
  const prisma = getPrisma(locale);
  return paginatedQuery(
    (skip, take) =>
      prisma.teacher.findMany({
        where,
        skip,
        take,
        include: teacherListInclude,
        orderBy,
      }),
    () => prisma.teacher.count({ where }),
    page,
    pageSize,
  );
}
