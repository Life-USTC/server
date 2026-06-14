import {
  getMessages,
  optionalValue,
  PAGE_SIZE,
  parsePositivePage,
  toLoadData,
} from "@/lib/page-data-utils";
import {
  cachedPublicRuntimeData,
  publicRuntimeCacheKey,
} from "@/lib/public-runtime-cache";

const COURSE_LIST_CACHE_TTL_MS = 60_000;

export async function getCourseListPage(url: URL, locale = "zh-cn") {
  return cachedPublicRuntimeData(
    publicRuntimeCacheKey(`course-list:${locale}`, url.searchParams),
    COURSE_LIST_CACHE_TTL_MS,
    () => getUncachedCourseListPage(url, locale),
  );
}

async function getUncachedCourseListPage(url: URL, locale = "zh-cn") {
  const [{ buildCourseListWhere }, { paginatedCourseQuery }, { getPrisma }] =
    await Promise.all([
      import("@/lib/course-section-queries"),
      import("@/lib/query-helpers"),
      import("@/lib/db/prisma"),
    ]);
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
      paginatedCourseQuery(
        page,
        PAGE_SIZE,
        buildCourseListWhere({
          search,
          educationLevelId,
          categoryId,
          classTypeId,
        }),
        [{ code: "asc" }, { jwId: "asc" }],
        locale,
      ),
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
