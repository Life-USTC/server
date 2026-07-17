import type { AppLocale } from "@/i18n/config";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { getPrisma } from "@/lib/db/prisma";
import { paginatedTeacherQuery } from "./academic-paginated-queries";
import {
  teacherDetailInclude,
  teacherListInclude,
} from "./academic-query-includes";
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
  return paginatedTeacherQuery(
    pagination.page,
    pagination.pageSize,
    buildTeacherWhere(filters),
    { nameCn: "asc" },
    locale,
  );
}

export function findTeacherDetailById(id: number, locale = DEFAULT_LOCALE) {
  return getPrisma(locale).teacher.findUnique({
    where: { id },
    include: teacherDetailInclude,
  });
}

export async function findTeachersByIds(
  ids: readonly number[],
  locale = DEFAULT_LOCALE,
) {
  const teachers = await getPrisma(locale).teacher.findMany({
    where: { id: { in: [...new Set(ids)] } },
    include: teacherListInclude,
  });
  const byId = new Map(teachers.map((teacher) => [teacher.id, teacher]));
  return ids.map((id) => byId.get(id) ?? null);
}
