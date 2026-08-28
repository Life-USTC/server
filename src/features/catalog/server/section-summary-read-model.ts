import type { Prisma } from "@/generated/prisma/client";
import type { AppLocale } from "@/i18n/config";
import { DEFAULT_LOCALE } from "@/i18n/config";
import {
  paginatedSectionCatalogQuery,
  paginatedSectionSummaryQuery,
} from "./academic-paginated-queries";
import { cachedCatalogListRead } from "./catalog-list-cache";
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
  return cachedCatalogListRead({
    filters,
    kind: "sections",
    locale,
    pagination,
    shape: "summary",
    load: async () => {
      const { where, orderBy } = buildSectionListQuery(filters);
      return paginatedSectionSummaryQuery(
        pagination.page,
        pagination.pageSize,
        where,
        orderBy ?? SECTION_SUMMARY_DEFAULT_ORDER_BY,
        locale,
      );
    },
  });
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
  return cachedCatalogListRead({
    filters,
    kind: "sections",
    locale,
    pagination,
    shape: "catalog",
    load: async () => {
      const { where, orderBy } = buildSectionListQuery(filters);
      return paginatedSectionCatalogQuery(
        pagination.page,
        pagination.pageSize,
        where,
        orderBy ?? SECTION_SUMMARY_DEFAULT_ORDER_BY,
        locale,
      );
    },
  });
}
