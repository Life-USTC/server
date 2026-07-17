import type { Prisma } from "@/generated/prisma/client";
import type { AppLocale } from "@/i18n/config";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { getPrisma } from "@/lib/db/prisma";
import { parseIntegerFilter } from "@/lib/query-filter-helpers";
import {
  paginatedSectionCatalogQuery,
  paginatedSectionSummaryQuery,
} from "./academic-paginated-queries";
import { resolveCourseIdByJwId } from "./course-jw-id";
import {
  buildSectionListQuery,
  type SectionListFilters,
} from "./course-section-query-filters";

export const SECTION_SUMMARY_DEFAULT_ORDER_BY = {
  semester: { jwId: "desc" },
} satisfies Prisma.SectionOrderByWithRelationInput;

async function resolveSectionListQuery(
  filters: SectionListFilters,
  locale: AppLocale,
) {
  const query = buildSectionListQuery(filters);
  const courseJwId = parseIntegerFilter(filters.courseJwId);
  if (courseJwId == null) return query;

  const requestedCourseId = parseIntegerFilter(filters.courseId);
  const canonicalCourseId = await resolveCourseIdByJwId(
    getPrisma(locale),
    courseJwId,
  );
  query.where.courseId =
    canonicalCourseId == null ||
    (requestedCourseId != null && requestedCourseId !== canonicalCourseId)
      ? { in: [] }
      : canonicalCourseId;
  return query;
}

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
  const { where, orderBy } = await resolveSectionListQuery(filters, locale);
  return paginatedSectionSummaryQuery(
    pagination.page,
    pagination.pageSize,
    where,
    orderBy ?? SECTION_SUMMARY_DEFAULT_ORDER_BY,
    locale,
  );
}

export async function listSections({
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
  const { where, orderBy } = await resolveSectionListQuery(filters, locale);
  return paginatedSectionCatalogQuery(
    pagination.page,
    pagination.pageSize,
    where,
    orderBy ?? SECTION_SUMMARY_DEFAULT_ORDER_BY,
    locale,
  );
}
