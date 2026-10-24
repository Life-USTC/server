import {
  catalogTableFilterValues,
  normalizeCatalogListQuery,
} from "@/features/catalog/lib/catalog-list-query";
import { CATALOG_PAGE_SIZE } from "@/features/catalog/server/catalog-page-constants";
import {
  cachedCatalogListRuntimeData,
  catalogListCacheNamespace,
} from "@/features/catalog/server/catalog-runtime-cache";
import { getTeacherListFilterOptions } from "@/features/catalog/server/public-catalog-filter-options";
import { type AppLocale, DEFAULT_LOCALE } from "@/i18n/config";
import { getMessages } from "@/i18n/messages.server";
import { parsePositivePage, toLoadData } from "@/lib/load-data-utils";
import { listTeacherTableSummaries } from "./catalog-table-read-model";

export async function getTeacherListPage(
  url: URL,
  locale: AppLocale = DEFAULT_LOCALE,
) {
  const searchParams = normalizeCatalogListQuery(
    "/catalog/teachers",
    url.searchParams,
  );
  const namespace = catalogListCacheNamespace("teachers", locale, "page");
  const [result, filterOptions, messages] = await Promise.all([
    cachedCatalogListRuntimeData(namespace, url.origin, searchParams, () =>
      getUncachedTeacherListPage(searchParams, locale),
    ),
    getTeacherListFilterOptions(locale, url.origin),
    getMessages(locale),
  ]);
  return {
    ...result,
    filterOptions,
    labels: {
      common: messages.common,
      teachers: messages.teachers,
    },
  };
}

async function getUncachedTeacherListPage(
  searchParams: URLSearchParams,
  locale: AppLocale = DEFAULT_LOCALE,
) {
  const page = parsePositivePage(searchParams.get("page"));
  const filters = catalogTableFilterValues("/catalog/teachers", searchParams);
  const result = await listTeacherTableSummaries({
    filters,
    locale,
    pagination: { page, pageSize: CATALOG_PAGE_SIZE },
  });
  return toLoadData({ ...result, filters });
}
