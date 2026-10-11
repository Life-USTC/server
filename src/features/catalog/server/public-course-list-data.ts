import { normalizeCatalogListQuery } from "@/features/catalog/lib/catalog-list-query";
import { CATALOG_PAGE_SIZE } from "@/features/catalog/server/catalog-page-constants";
import { listCourseSummaries } from "@/features/catalog/server/course-section-queries";
import { getCourseListFilterOptions } from "@/features/catalog/server/public-catalog-filter-options";
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
  const search = optionalValue(searchParams.get("search"));
  const educationLevelId = optionalValue(searchParams.get("educationLevelId"));
  const categoryId = optionalValue(searchParams.get("categoryId"));
  const classTypeId = optionalValue(searchParams.get("classTypeId"));

  const result = await listCourseSummaries({
    filters: { search, educationLevelId, categoryId, classTypeId },
    locale,
    pagination: { page, pageSize: CATALOG_PAGE_SIZE },
  });

  return toLoadData({
    ...result,
    filters: { search, educationLevelId, categoryId, classTypeId },
  });
}
