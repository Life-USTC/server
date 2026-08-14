import type { AppLocale } from "@/i18n/config";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { cachedPublicDetailRuntimeData } from "@/lib/catalog-detail-runtime-cache";
import { getPrisma } from "@/lib/db/prisma";
import { paginatedTeacherQuery } from "./academic-paginated-queries";
import {
  teacherPublicDetailSelect,
  teacherPublicListSelect,
} from "./academic-query-includes";
import { cachedCatalogListRead } from "./catalog-list-cache";
import { buildTeacherWhere } from "./teacher-query";

type TeacherListFilters = Parameters<typeof buildTeacherWhere>[0];

export function listTeacherSummaries({
  filters,
  locale = DEFAULT_LOCALE,
  pagination,
}: {
  filters: TeacherListFilters;
  locale?: AppLocale;
  pagination: {
    page: number;
    pageSize: number;
  };
}) {
  return cachedCatalogListRead({
    filters,
    kind: "teachers",
    locale,
    pagination,
    shape: "summary",
    load: () =>
      paginatedTeacherQuery(
        pagination.page,
        pagination.pageSize,
        buildTeacherWhere(filters),
        { nameCn: "asc" },
        locale,
      ),
  });
}

export function findTeacherDetailById(id: number, locale = DEFAULT_LOCALE) {
  return cachedPublicDetailRuntimeData({
    id,
    kind: "teacher",
    locale,
    shape: "detail-v1",
    load: () =>
      getPrisma(locale).teacher.findUnique({
        where: { id },
        select: teacherPublicDetailSelect,
      }),
  });
}

export async function findTeachersByIds(
  ids: readonly number[],
  locale = DEFAULT_LOCALE,
) {
  if (ids.length === 1) {
    return [await findTeacherDetailById(ids[0], locale)];
  }

  const teachers = await getPrisma(locale).teacher.findMany({
    where: { id: { in: [...new Set(ids)] } },
    select: teacherPublicListSelect,
  });
  const byId = new Map(teachers.map((teacher) => [teacher.id, teacher]));
  return ids.map((id) => byId.get(id) ?? null);
}
