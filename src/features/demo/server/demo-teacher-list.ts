import type { TeacherListFilters } from "@/features/catalog/components/catalog-teacher-list-types";
import {
  catalogTableFilterValues,
  normalizeCatalogListQuery,
} from "@/features/catalog/lib/catalog-list-query";
import { CATALOG_PAGE_SIZE } from "@/features/catalog/server/catalog-page-constants";
import type { AppLocale } from "@/i18n/config";
import { getMessages } from "@/i18n/messages.server";
import { parsePositivePage } from "@/lib/load-data-utils";
import { buildPaginatedResponse } from "@/lib/pagination";
import { demoCatalogTextMatches as textMatches } from "./demo-catalog-text-match";
import { getDemoSubscribedSections } from "./demo-subscriptions";

function countMatches(count: number, filters: TeacherListFilters) {
  if (filters.sectionCount == null) return true;
  const expected = Number(filters.sectionCount);
  switch (filters.sectionCountOp ?? "eq") {
    case "ne":
      return count !== expected;
    case "gt":
      return count > expected;
    case "gte":
      return count >= expected;
    case "lt":
      return count < expected;
    case "lte":
      return count <= expected;
    case "between":
      return count >= expected && count <= Number(filters.sectionCountMax);
    default:
      return count === expected;
  }
}

/** Fixed subscription teachers and historical counts, shared by Web and REST. */
export function getDemoTeacherList(
  locale: AppLocale,
  filters: TeacherListFilters,
  { page, pageSize }: { page: number; pageSize: number },
) {
  const sections = getDemoSubscribedSections(locale);
  const teachers = [
    ...new Map(
      sections
        .flatMap((section) => section.teachers)
        .map((teacher) => [teacher.id, teacher]),
    ).values(),
  ]
    .map((teacher) => ({
      ...teacher,
      email: null,
      telephone: null,
      mobile: null,
      address: null,
      departmentId: null,
      teacherTitleId: null,
      department: null,
      teacherTitle: null,
      _count: {
        sections: sections.filter((section) =>
          section.teachers.some((item) => item.id === teacher.id),
        ).length,
      },
    }))
    .filter((teacher) => {
      // Samples have no classification/contact metadata; never fetch live options.
      if (
        filters.departmentId ||
        filters.teacherTitleId ||
        !textMatches(teacher.email, filters.email)
      )
        return false;
      const nameMatches = (query: string | null | undefined) =>
        textMatches(teacher.nameCn, query) ||
        textMatches(teacher.nameEn, query);
      return (
        nameMatches(filters.name) &&
        textMatches(teacher.code, filters.code) &&
        (!filters.search ||
          nameMatches(filters.search) ||
          textMatches(teacher.code, filters.search)) &&
        countMatches(teacher._count.sections, filters)
      );
    });
  teachers.sort((a, b) =>
    a.nameCn < b.nameCn ? -1 : a.nameCn > b.nameCn ? 1 : a.jwId - b.jwId,
  );
  return buildPaginatedResponse(
    teachers.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    teachers.length,
  );
}

export async function getDemoTeacherListPage(url: URL, locale: AppLocale) {
  const params = normalizeCatalogListQuery(
    "/catalog/teachers",
    url.searchParams,
  );
  const filters = catalogTableFilterValues("/catalog/teachers", params);
  const messages = await getMessages(locale);
  return {
    ...getDemoTeacherList(locale, filters, {
      page: parsePositivePage(params.get("page")),
      pageSize: CATALOG_PAGE_SIZE,
    }),
    filters,
    filterOptions: { departments: [], teacherTitles: [] },
    labels: { common: messages.common, teachers: messages.teachers },
  };
}
