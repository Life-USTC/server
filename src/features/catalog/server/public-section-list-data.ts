import { CATALOG_PAGE_SIZE } from "@/features/catalog/server/catalog-page-constants";
import { getMessages } from "@/i18n/messages.server";
import {
  optionalValue,
  parsePositivePage,
  toLoadData,
} from "@/lib/load-data-utils";
import {
  cachedPublicRuntimeData,
  publicRuntimeCacheKey,
} from "@/lib/public-runtime-cache";

const SECTION_LIST_CACHE_TTL_MS = 60_000;

export async function getSectionListPage(url: URL, locale = "zh-cn") {
  return cachedPublicRuntimeData(
    publicRuntimeCacheKey(`section-list:${locale}`, url.searchParams),
    SECTION_LIST_CACHE_TTL_MS,
    () => getUncachedSectionListPage(url, locale),
  );
}

async function getUncachedSectionListPage(url: URL, locale = "zh-cn") {
  const [
    { buildSectionListQuery },
    { paginatedSectionSummaryQuery },
    { getPrisma },
  ] = await Promise.all([
    import("@/features/catalog/server/course-section-queries"),
    import("@/features/catalog/server/academic-paginated-queries"),
    import("@/lib/db/prisma"),
  ]);
  const page = parsePositivePage(url.searchParams.get("page"));
  const search = optionalValue(url.searchParams.get("search"));
  const semesterId = optionalValue(url.searchParams.get("semesterId"));
  const { where, orderBy } = buildSectionListQuery({ semesterId, search });
  const prisma = getPrisma(locale);

  const [result, semesters, messages] = await Promise.all([
    paginatedSectionSummaryQuery(
      page,
      CATALOG_PAGE_SIZE,
      where,
      orderBy ?? { semester: { jwId: "desc" as const } },
      locale,
    ),
    prisma.semester.findMany({
      select: { id: true, nameCn: true },
      take: 100,
      orderBy: { jwId: "desc" },
    }),
    getMessages(locale),
  ]);

  return toLoadData({
    ...result,
    filters: { search, semesterId },
    filterOptions: { semesters },
    labels: {
      common: messages.common,
      sections: {
        ...messages.sections,
        close: messages.sectionDetail.close,
      },
    },
  });
}
