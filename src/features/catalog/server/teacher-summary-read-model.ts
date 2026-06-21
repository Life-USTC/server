import type { AppLocale } from "@/i18n/config";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { getPrisma } from "@/lib/db/prisma";
import { paginatedTeacherQuery } from "./academic-paginated-queries";
import { teacherDetailInclude } from "./academic-query-includes";
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
