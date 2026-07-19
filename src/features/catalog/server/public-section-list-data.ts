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
  const orderParam = optionalValue(url.searchParams.get("order"));
  const order: "asc" | "desc" | undefined =
    orderParam === "asc" || orderParam === "desc" ? orderParam : undefined;
  const filters = {
    campusId: optionalValue(url.searchParams.get("campusId")),
    categoryId: optionalValue(url.searchParams.get("categoryId")),
    classTypeId: optionalValue(url.searchParams.get("classTypeId")),
    courseCode: optionalValue(url.searchParams.get("courseCode")),
    credits: optionalValue(url.searchParams.get("credits")),
    departmentId: optionalValue(url.searchParams.get("departmentId")),
    educationLevelId: optionalValue(url.searchParams.get("educationLevelId")),
    order,
    search: optionalValue(url.searchParams.get("search")),
    sectionCode: optionalValue(url.searchParams.get("sectionCode")),
    semesterId: optionalValue(url.searchParams.get("semesterId")),
    sort: optionalValue(url.searchParams.get("sort")),
    teacher: optionalValue(url.searchParams.get("teacher")),
  };
  const prisma = getPrisma(locale);

  const [
    result,
    semesters,
    campuses,
    departments,
    categories,
    educationLevels,
    classTypes,
    messages,
  ] = await Promise.all([
    listSectionSummaries({
      filters,
      locale,
      pagination: { page, pageSize: CATALOG_PAGE_SIZE },
    }),
    prisma.semester.findMany({
      select: { id: true, nameCn: true },
      take: 100,
      orderBy: { jwId: "desc" },
    }),
    prisma.campus.findMany({
      where: { sections: { some: { retiredAt: null } } },
      orderBy: { nameCn: "asc" },
    }),
    prisma.department.findMany({
      where: { sections: { some: { retiredAt: null } } },
      orderBy: { nameCn: "asc" },
    }),
    prisma.courseCategory.findMany({
      where: {
        courses: { some: { sections: { some: { retiredAt: null } } } },
      },
      orderBy: { nameCn: "asc" },
    }),
    prisma.educationLevel.findMany({
      where: {
        courses: { some: { sections: { some: { retiredAt: null } } } },
      },
      orderBy: { nameCn: "asc" },
    }),
    prisma.classType.findMany({
      where: {
        courses: { some: { sections: { some: { retiredAt: null } } } },
      },
      orderBy: { nameCn: "asc" },
    }),
    getMessages(locale),
  ]);

  return toLoadData({
    ...result,
    filters,
    filterOptions: {
      campuses,
      categories,
      classTypes,
      departments,
      educationLevels,
      semesters,
    },
    labels: {
      common: messages.common,
      sections: {
        ...messages.sections,
        close: messages.sectionDetail.close,
      },
    },
  });
}
