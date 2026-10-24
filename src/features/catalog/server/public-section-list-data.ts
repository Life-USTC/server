import {
  catalogTableFilterValues,
  normalizeCatalogListQuery,
} from "@/features/catalog/lib/catalog-list-query";
import { CATALOG_PAGE_SIZE } from "@/features/catalog/server/catalog-page-constants";
import {
  cachedCatalogListRuntimeData,
  catalogListCacheNamespace,
} from "@/features/catalog/server/catalog-runtime-cache";
import { getSectionListFilterOptions } from "@/features/catalog/server/public-catalog-filter-options";
import { type AppLocale, DEFAULT_LOCALE } from "@/i18n/config";
import { getMessages } from "@/i18n/messages.server";
import { parsePositivePage, toLoadData } from "@/lib/load-data-utils";
import { listSectionTableSummaries } from "./catalog-table-read-model";

export async function getSectionListPage(
  url: URL,
  locale: AppLocale = DEFAULT_LOCALE,
) {
  const searchParams = normalizeCatalogListQuery(
    "/catalog/sections",
    url.searchParams,
  );
  const namespace = catalogListCacheNamespace("sections", locale, "page");
  const [result, filterOptions, messages] = await Promise.all([
    cachedCatalogListRuntimeData(namespace, url.origin, searchParams, () =>
      getUncachedSectionListPage(searchParams, locale),
    ),
    getSectionListFilterOptions(locale, url.origin),
    getMessages(locale),
  ]);
  return {
    ...result,
    filterOptions,
    labels: {
      common: messages.common,
      sections: { ...messages.sections, close: messages.sectionDetail.close },
    },
  };
}

async function getUncachedSectionListPage(
  searchParams: URLSearchParams,
  locale: AppLocale = DEFAULT_LOCALE,
) {
  const page = parsePositivePage(searchParams.get("page"));
  const filters = catalogTableFilterValues("/catalog/sections", searchParams);
  const result = await listSectionTableSummaries({
    filters,
    locale,
    pagination: { page, pageSize: CATALOG_PAGE_SIZE },
  });
  return toLoadData({ ...result, filters });
}
