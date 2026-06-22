import type { Prisma } from "@/generated/prisma/client";
import type { AppLocale } from "@/i18n/config";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { paginatedCourseQuery } from "./academic-paginated-queries";
import {
  buildCourseListWhere,
  type CourseListFilters,
} from "./course-section-query-filters";

export const COURSE_SUMMARY_DEFAULT_ORDER_BY = [
  { code: "asc" },
  { jwId: "asc" },
] satisfies Prisma.CourseOrderByWithRelationInput[];

export function listCourseSummaries({
  filters,
  locale = DEFAULT_LOCALE,
  pagination,
}: {
  filters: CourseListFilters;
  locale?: AppLocale;
  pagination: {
    page: number;
    pageSize: number;
  };
}) {
  return paginatedCourseQuery(
    pagination.page,
    pagination.pageSize,
    buildCourseListWhere(filters),
    COURSE_SUMMARY_DEFAULT_ORDER_BY,
    locale,
  );
}
