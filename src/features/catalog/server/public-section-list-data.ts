import { CATALOG_PAGE_SIZE } from "@/features/catalog/server/catalog-page-constants";
import { listSectionSummaries } from "@/features/catalog/server/course-section-queries";
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

const SECTION_LIST_CACHE_TTL_MS = 60_000;

export async function getSectionListPage(
  url: URL,
  locale: AppLocale = DEFAULT_LOCALE,
) {
  return cachedPublicRuntimeData(
    publicRuntimeCacheKey(`section-list:${locale}`, url.searchParams),
    SECTION_LIST_CACHE_TTL_MS,
    () => getUncachedSectionListPage(url, locale),
  );
}

async function getUncachedSectionListPage(
  url: URL,
  locale: AppLocale = DEFAULT_LOCALE,
) {
  const page = parsePositivePage(url.searchParams.get("page"));
  const search = optionalValue(url.searchParams.get("search"));
  const semesterId = optionalValue(url.searchParams.get("semesterId"));
  const prisma = getPrisma(locale);

  const [result, semesters, messages] = await Promise.all([
    listSectionSummaries({
      filters: { semesterId, search },
      locale,
      pagination: { page, pageSize: CATALOG_PAGE_SIZE },
    }),
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
