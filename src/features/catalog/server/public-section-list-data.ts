import { normalizeCatalogListQuery } from "@/features/catalog/lib/catalog-list-query";
import { CATALOG_PAGE_SIZE } from "@/features/catalog/server/catalog-page-constants";
import {
  cachedCatalogListRuntimeData,
  catalogListCacheNamespace,
} from "@/features/catalog/server/catalog-runtime-cache";
import { listSectionSummaries } from "@/features/catalog/server/course-section-queries";
import { getSectionListFilterOptions } from "@/features/catalog/server/public-catalog-filter-options";
import { type AppLocale, DEFAULT_LOCALE } from "@/i18n/config";
import { getMessages } from "@/i18n/messages.server";
import {
  optionalValue,
  parsePositivePage,
  toLoadData,
} from "@/lib/load-data-utils";

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
  const orderParam = optionalValue(searchParams.get("order"));
  const order: "asc" | "desc" | undefined =
    orderParam === "asc" || orderParam === "desc" ? orderParam : undefined;
  const filters = {
    campusId: optionalValue(searchParams.get("campusId")),
    categoryId: optionalValue(searchParams.get("categoryId")),
    classTypeId: optionalValue(searchParams.get("classTypeId")),
    courseCode: optionalValue(searchParams.get("courseCode")),
    credits: optionalValue(searchParams.get("credits")),
    departmentId: optionalValue(searchParams.get("departmentId")),
    educationLevelId: optionalValue(searchParams.get("educationLevelId")),
    order,
    search: optionalValue(searchParams.get("search")),
    sectionCode: optionalValue(searchParams.get("sectionCode")),
    semesterId: optionalValue(searchParams.get("semesterId")),
    sort: optionalValue(searchParams.get("sort")),
    teacher: optionalValue(searchParams.get("teacher")),
  };

  const result = await listSectionSummaries({
    filters,
    locale,
    pagination: { page, pageSize: CATALOG_PAGE_SIZE },
  });

  return toLoadData({
    ...result,
    filters,
  });
}
