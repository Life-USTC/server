import {
  catalogTableFilterValues,
  normalizeCatalogListQuery,
} from "@/features/catalog/lib/catalog-list-query";
import { CATALOG_PAGE_SIZE } from "@/features/catalog/server/catalog-page-constants";
import {
  cachedCatalogListRuntimeData,
  catalogListCacheNamespace,
} from "@/features/catalog/server/catalog-runtime-cache";
import { getCourseListFilterOptions } from "@/features/catalog/server/public-catalog-filter-options";
import { type AppLocale, DEFAULT_LOCALE } from "@/i18n/config";
import { getMessages } from "@/i18n/messages.server";
import { parsePositivePage, toLoadData } from "@/lib/load-data-utils";
import { listCourseTableSummaries } from "./catalog-table-read-model";

export async function getCourseListPage(
  url: URL,
  locale: AppLocale = DEFAULT_LOCALE,
) {
  const searchParams = normalizeCatalogListQuery(
    "/catalog/courses",
    url.searchParams,
  );
  const namespace = catalogListCacheNamespace("courses", locale, "page");
  const [result, filterOptions, messages] = await Promise.all([
    cachedCatalogListRuntimeData(namespace, url.origin, searchParams, () =>
      getUncachedCourseListPage(searchParams, locale),
    ),
    getCourseListFilterOptions(locale, url.origin),
    getMessages(locale),
  ]);
  return {
    ...result,
    filterOptions,
    labels: {
      common: messages.common,
      courses: messages.courses,
    },
  };
}

async function getUncachedCourseListPage(
  searchParams: URLSearchParams,
  locale: AppLocale = DEFAULT_LOCALE,
) {
  const page = parsePositivePage(searchParams.get("page"));
  const filters = catalogTableFilterValues("/catalog/courses", searchParams);
  const result = await listCourseTableSummaries({
    filters,
    locale,
    pagination: { page, pageSize: CATALOG_PAGE_SIZE },
  });
  return toLoadData({ ...result, filters });
}
