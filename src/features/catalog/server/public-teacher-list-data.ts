import { paginatedTeacherQuery } from "@/features/catalog/server/academic-paginated-queries";
import { CATALOG_PAGE_SIZE } from "@/features/catalog/server/catalog-page-constants";
import { buildTeacherWhere } from "@/features/catalog/server/teacher-query";
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

const TEACHER_LIST_CACHE_TTL_MS = 60_000;

export async function getTeacherListPage(url: URL, locale = "zh-cn") {
  return cachedPublicRuntimeData(
    publicRuntimeCacheKey(`teacher-list:${locale}`, url.searchParams),
    TEACHER_LIST_CACHE_TTL_MS,
    () => getUncachedTeacherListPage(url, locale),
  );
}

async function getUncachedTeacherListPage(url: URL, locale = "zh-cn") {
  const page = parsePositivePage(url.searchParams.get("page"));
  const search = optionalValue(url.searchParams.get("search"));
  const departmentId = optionalValue(url.searchParams.get("departmentId"));
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
