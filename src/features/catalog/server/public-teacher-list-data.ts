import { normalizeCatalogListQuery } from "@/features/catalog/lib/catalog-list-query";
import { paginatedTeacherQuery } from "@/features/catalog/server/academic-paginated-queries";
import { CATALOG_PAGE_SIZE } from "@/features/catalog/server/catalog-page-constants";
import { buildTeacherWhere } from "@/features/catalog/server/teacher-query";
import { type AppLocale, DEFAULT_LOCALE } from "@/i18n/config";
import { getMessages } from "@/i18n/messages.server";
import {
  cachedCatalogListRuntimeData,
  catalogListCacheNamespace,
} from "@/lib/catalog-runtime-cache";
import { getPrisma } from "@/lib/db/prisma";
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
  return cachedCatalogListRuntimeData(namespace, url.origin, searchParams, () =>
    getUncachedTeacherListPage(searchParams, locale),
  );
}

async function getUncachedTeacherListPage(
  searchParams: URLSearchParams,
  locale: AppLocale = DEFAULT_LOCALE,
) {
  const page = parsePositivePage(searchParams.get("page"));
  const search = optionalValue(searchParams.get("search"));
  const departmentId = optionalValue(searchParams.get("departmentId"));
  const where = buildTeacherWhere({ departmentId, search });

  const prisma = getPrisma(locale);
  const [result, departments, messages] = await Promise.all([
    paginatedTeacherQuery(
      page,
      CATALOG_PAGE_SIZE,
      where,
      { nameCn: "asc" },
      locale,
    ),
    prisma.department.findMany({
      where: { teachers: { some: {} } },
      select: { id: true, nameCn: true, nameEn: true },
      orderBy: { nameCn: "asc" },
    }),
    getMessages(locale),
  ]);

  return toLoadData({
    ...result,
    filters: { search, departmentId },
    filterOptions: { departments },
    labels: {
      common: messages.common,
      teachers: messages.teachers,
    },
  });
}
