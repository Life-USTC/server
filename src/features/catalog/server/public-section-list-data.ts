import { normalizeCatalogListQuery } from "@/features/catalog/lib/catalog-list-query";
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
  catalogListCacheNamespace,
  cachedCatalogListRuntimeData,
} from "@/lib/catalog-runtime-cache";

export async function getSectionListPage(
  url: URL,
  locale: AppLocale = DEFAULT_LOCALE,
) {
  const searchParams = normalizeCatalogListQuery(
    "/catalog/sections",
    url.searchParams,
  );
  const namespace = catalogListCacheNamespace("sections", locale, "page");
  return cachedCatalogListRuntimeData(
    namespace,
    url.origin,
    searchParams,
    () => getUncachedSectionListPage(searchParams, locale),
  );
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
