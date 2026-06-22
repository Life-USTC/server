import type { Prisma } from "@/generated/prisma/client";
import type { AppLocale } from "@/i18n/config";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { paginatedSectionSummaryQuery } from "./academic-paginated-queries";
import {
  buildSectionListQuery,
  type SectionListFilters,
} from "./course-section-query-filters";

export const SECTION_SUMMARY_DEFAULT_ORDER_BY = {
  semester: { jwId: "desc" },
} satisfies Prisma.SectionOrderByWithRelationInput;

export function listSectionSummaries({
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
  return paginatedSectionSummaryQuery(
    pagination.page,
    pagination.pageSize,
    where,
    orderBy ?? SECTION_SUMMARY_DEFAULT_ORDER_BY,
    locale,
  );
}
