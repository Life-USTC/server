import { CATALOG_PAGE_SIZE } from "@/features/catalog/server/catalog-page-constants";
import { listCourseSummaries } from "@/features/catalog/server/course-section-queries";
import { type AppLocale, DEFAULT_LOCALE } from "@/i18n/config";
import { getMessages } from "@/i18n/messages.server";
import { getPrisma } from "@/lib/db/prisma";
import {
  optionalValue,
  parsePositivePage,
  toLoadData,
} from "@/lib/load-data-utils";
import {
  cachedPublicRuntimeData,
  publicRuntimeCacheKey,
} from "@/lib/public-runtime-cache";

const COURSE_LIST_CACHE_TTL_MS = 60_000;

export async function getCourseListPage(
  url: URL,
  locale: AppLocale = DEFAULT_LOCALE,
) {
  return cachedPublicRuntimeData(
    publicRuntimeCacheKey(`course-list:${locale}`, url.searchParams),
    COURSE_LIST_CACHE_TTL_MS,
    () => getUncachedCourseListPage(url, locale),
  );
}

async function getUncachedCourseListPage(
  url: URL,
  locale: AppLocale = DEFAULT_LOCALE,
) {
  const page = parsePositivePage(url.searchParams.get("page"));
  const search = optionalValue(url.searchParams.get("search"));
  const educationLevelId = optionalValue(
    url.searchParams.get("educationLevelId"),
  );
  const categoryId = optionalValue(url.searchParams.get("categoryId"));
  const classTypeId = optionalValue(url.searchParams.get("classTypeId"));
  const prisma = getPrisma(locale);

  const [result, educationLevels, categories, classTypes, messages] =
    await Promise.all([
      listCourseSummaries({
        filters: {
          search,
          educationLevelId,
          categoryId,
          classTypeId,
        },
        locale,
        pagination: { page, pageSize: CATALOG_PAGE_SIZE },
      }),
      prisma.educationLevel.findMany({ orderBy: { nameCn: "asc" } }),
      prisma.courseCategory.findMany({ orderBy: { nameCn: "asc" } }),
      prisma.classType.findMany({ orderBy: { nameCn: "asc" } }),
      getMessages(locale),
    ]);

  return toLoadData({
    ...result,
    filters: { search, educationLevelId, categoryId, classTypeId },
    filterOptions: { educationLevels, categories, classTypes },
    labels: {
      common: messages.common,
      courses: messages.courses,
    },
  });
}
