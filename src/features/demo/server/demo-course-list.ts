import type { CourseListFilters } from "@/features/catalog/components/catalog-course-list-types";
import {
  catalogTableFilterValues,
  normalizeCatalogListQuery,
} from "@/features/catalog/lib/catalog-list-query";
import { CATALOG_PAGE_SIZE } from "@/features/catalog/server/catalog-page-constants";
import type { AppLocale } from "@/i18n/config";
import { getMessages } from "@/i18n/messages.server";
import { parsePositivePage } from "@/lib/load-data-utils";
import { buildPaginatedResponse } from "@/lib/pagination";
import { getDemoSubscribedSections } from "./demo-subscriptions";

// The ordinary catalog uses ILIKE '%value%'. Match its wildcards/escapes with
// bounded dynamic programming instead of backtracking user-supplied patterns.
function textMatches(value: string | null, filter: string | null | undefined) {
  if (!filter) return true;
  if (value === null) return false;
  const text = [...value.toLowerCase()];
  let matches = [true, ...text.map(() => false)];
  let escaped = false;
  for (const char of `%${filter.toLowerCase()}%`) {
    if (!escaped && char === "\\") {
      escaped = true;
      continue;
    }
    const many = !escaped && char === "%";
    const one = !escaped && char === "_";
    const next = [many && matches[0]];
    for (let index = 1; index <= text.length; index++) {
      next[index] = many
        ? matches[index] || next[index - 1]
        : matches[index - 1] && (one || text[index - 1] === char);
    }
    matches = next;
    escaped = false;
  }
  return matches[text.length];
}

/** One fixed dataset and ordering for Web page-data and REST collection reads. */
export function getDemoCourseList(
  locale: AppLocale,
  filters: CourseListFilters,
  { page, pageSize }: { page: number; pageSize: number },
) {
  const courses = [
    ...new Map(
      getDemoSubscribedSections(locale).map(({ course }) => [
        course.id,
        course,
      ]),
    ).values(),
  ].filter((course) => {
    for (const key of [
      "categoryId",
      "classTypeId",
      "educationLevelId",
    ] as const) {
      if (
        filters[key] &&
        (course[key] === null ||
          !filters[key].split(",").includes(String(course[key])))
      )
        return false;
    }
    const nameMatches = (query: string | null | undefined) =>
      textMatches(course.nameCn, query) || textMatches(course.nameEn, query);
    return (
      nameMatches(filters.name) &&
      textMatches(course.code, filters.code) &&
      (!filters.search ||
        nameMatches(filters.search) ||
        textMatches(course.code, filters.search))
    );
  });
  courses.sort((a, b) => a.code.localeCompare(b.code, "en") || a.jwId - b.jwId);
  return buildPaginatedResponse(
    courses.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    courses.length,
  );
}

export async function getDemoCourseListPage(url: URL, locale: AppLocale) {
  const params = normalizeCatalogListQuery(
    "/catalog/courses",
    url.searchParams,
  );
  const filters = catalogTableFilterValues("/catalog/courses", params);
  const messages = await getMessages(locale);
  return {
    ...getDemoCourseList(locale, filters, {
      page: parsePositivePage(params.get("page")),
      pageSize: CATALOG_PAGE_SIZE,
    }),
    filters,
    // Existing samples have no classifications. Never fetch live filter options.
    filterOptions: { categories: [], classTypes: [], educationLevels: [] },
    labels: { common: messages.common, courses: messages.courses },
  };
}
