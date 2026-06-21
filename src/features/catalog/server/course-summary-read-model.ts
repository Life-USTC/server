import type { AppLocale } from "@/i18n/config";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { paginatedCourseQuery } from "./academic-paginated-queries";
import {
  buildCourseListWhere,
  type CourseListFilters,
} from "./course-section-query-filters";

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
    undefined,
    locale,
  );
}
