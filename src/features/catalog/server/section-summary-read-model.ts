import type { Prisma } from "@/generated/prisma/client";
import type { AppLocale } from "@/i18n/config";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { getPrisma } from "@/lib/db/prisma";
import { parseIntegerFilter } from "@/lib/query-filter-helpers";
import { paginatedSectionSummaryQuery } from "./academic-paginated-queries";
import { resolveCourseIdByJwId } from "./course-jw-id";
import {
  buildSectionListQuery,
  type SectionListFilters,
} from "./course-section-query-filters";

export const SECTION_SUMMARY_DEFAULT_ORDER_BY = {
  semester: { jwId: "desc" },
} satisfies Prisma.SectionOrderByWithRelationInput;

export async function listSectionSummaries({
  filters,
  locale = DEFAULT_LOCALE,
  pagination,
}: {
  filters: SectionListFilters;
  locale?: AppLocale;
  pagination: {
    page: number;
    pageSize: number;
  };
}) {
  const { where, orderBy } = buildSectionListQuery(filters);
  const courseJwId = parseIntegerFilter(filters.courseJwId);
  if (courseJwId != null) {
    const requestedCourseId = parseIntegerFilter(filters.courseId);
    const canonicalCourseId = await resolveCourseIdByJwId(
      getPrisma(locale),
      courseJwId,
    );
    where.courseId =
      canonicalCourseId == null ||
      (requestedCourseId != null && requestedCourseId !== canonicalCourseId)
        ? { in: [] }
        : canonicalCourseId;
  }
  return paginatedSectionSummaryQuery(
    pagination.page,
    pagination.pageSize,
    where,
    orderBy ?? SECTION_SUMMARY_DEFAULT_ORDER_BY,
    locale,
  );
}
