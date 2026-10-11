import { normalizeCatalogListQuery } from "@/features/catalog/lib/catalog-list-query";
import { paginatedTeacherQuery } from "@/features/catalog/server/academic-paginated-queries";
import { CATALOG_PAGE_SIZE } from "@/features/catalog/server/catalog-page-constants";
import { getTeacherListFilterOptions } from "@/features/catalog/server/public-catalog-filter-options";
import { buildTeacherWhere } from "@/features/catalog/server/teacher-query";
import { type AppLocale, DEFAULT_LOCALE } from "@/i18n/config";
import { getMessages } from "@/i18n/messages.server";
import {
  cachedCatalogListRuntimeData,
  catalogListCacheNamespace,
} from "@/lib/catalog-runtime-cache";
import {
  optionalValue,
  parsePositivePage,
  toLoadData,
} from "@/lib/load-data-utils";

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
  const search = optionalValue(searchParams.get("search"));
  const departmentId = optionalValue(searchParams.get("departmentId"));
  const where = buildTeacherWhere({ departmentId, search });

  const result = await paginatedTeacherQuery(
    page,
    CATALOG_PAGE_SIZE,
    where,
    { nameCn: "asc" },
    locale,
  );

  return toLoadData({
    ...result,
    filters: { search, departmentId },
  });
}
