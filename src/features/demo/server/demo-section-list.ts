import {
  catalogTableFilterValues,
  normalizeCatalogListQuery,
} from "@/features/catalog/lib/catalog-list-query";
import { toSectionSummaryDto } from "@/features/catalog/server/academic-summary-dto-mappers";
import { CATALOG_PAGE_SIZE } from "@/features/catalog/server/catalog-page-constants";
import { parseSectionSearchQuery } from "@/features/catalog/server/section-search-parser";
import type { AppLocale } from "@/i18n/config";
import { getMessages } from "@/i18n/messages.server";
import { parsePositivePage } from "@/lib/load-data-utils";
import { buildPaginatedResponse } from "@/lib/pagination";
import { searchTerms } from "@/lib/query-filter-helpers";
import { demoCatalogTextMatches as textMatches } from "./demo-catalog-text-match";
import { getDemoSubscribedSections } from "./demo-subscriptions";

type Filters = Record<string, string | undefined>;
type Section = ReturnType<typeof getDemoSubscribedSections>[number];
const nameMatches = (
  value: { nameCn: string; nameEn?: string | null } | null,
  filter: string | undefined,
) =>
  !filter ||
  (value !== null &&
    (textMatches(value.nameCn, filter) ||
      textMatches(value.nameEn ?? null, filter)));

function idMatches(value: number | null, filter: string | undefined) {
  return (
    !filter || (value !== null && filter.split(",").map(Number).includes(value))
  );
}

function numericMatches(value: number | null, key: string, filters: Filters) {
  if (filters[key] === undefined) return true;
  // SQL comparisons, including <>, do not match NULL. Missing sample metadata
  // must not become zero merely to satisfy a filter.
  if (value === null) return false;
  const expected = Number(filters[key]);
  switch (filters[`${key}Op`] ?? "eq") {
    case "ne":
      return value !== expected;
    case "gt":
      return value > expected;
    case "gte":
      return value >= expected;
    case "lt":
      return value < expected;
    case "lte":
      return value <= expected;
    case "between":
      return value >= expected && value <= Number(filters[`${key}Max`]);
    default:
      return value === expected;
  }
}

function matches(
  section: Section,
  filters: Filters,
  parsed: ReturnType<typeof parseSectionSearchQuery>,
) {
  for (const [key, value] of [
    ["ids", section.id],
    ["jwIds", section.jwId],
    ["courseId", section.courseId],
    ["courseJwId", section.course.jwId],
    ["semesterId", section.semesterId],
    ["semesterJwId", section.semester?.jwId ?? null],
    ["campusId", section.campusId],
    ["departmentId", section.openDepartmentId],
    ["categoryId", section.course.categoryId],
    ["classTypeId", section.course.classTypeId],
    ["educationLevelId", section.course.educationLevelId],
  ] as const)
    if (!idMatches(value, filters[key])) return false;
  if (
    (filters.teacherId || filters.teacherCode) &&
    !section.teachers.some(
      (teacher) =>
        idMatches(teacher.id, filters.teacherId) &&
        (!filters.teacherCode || teacher.code === filters.teacherCode),
    )
  )
    return false;
  for (const key of ["credits", "stdCount", "limitCount"] as const)
    if (!numericMatches(section[key], key, filters)) return false;
  if (!numericMatches(section.teachers.length, "teacherCount", filters))
    return false;
  if (!nameMatches(section.course, filters.courseName)) return false;
  // Match the existing advanced parser and explicit-column precedence on Web.
  const teacher = filters.teacher ?? parsed.teacher;
  if (teacher && !section.teachers.some((item) => nameMatches(item, teacher)))
    return false;
  if (
    !textMatches(
      section.course.code,
      filters.courseCode ?? parsed.courseCode,
    ) ||
    !textMatches(section.code, filters.sectionCode ?? parsed.lectureCode)
  )
    return false;
  if (
    filters.credits === undefined &&
    parsed.credits &&
    Number.isFinite(Number(parsed.credits)) &&
    section.credits !== Number(parsed.credits)
  )
    return false;
  for (const [key, value] of [
    ["campus", section.campus],
    ["department", section.openDepartment],
    ["category", section.course.category],
    ["classType", section.course.classType],
    ["level", section.course.educationLevel],
  ] as const)
    if (!nameMatches(value, parsed[key])) return false;
  if (!textMatches(section.semester?.nameCn ?? null, parsed.semester))
    return false;
  return searchTerms(parsed.general ?? "").every(
    (term) =>
      nameMatches(section.course, term) ||
      textMatches(section.course.code, term) ||
      textMatches(section.code, term) ||
      section.teachers.some((item) => nameMatches(item, term)),
  );
}

function sortValue(
  section: Section,
  sort: string,
): string | number | null | undefined {
  switch (sort) {
    case "credits":
    case "credit":
      return section.credits;
    case "capacity":
      return section.stdCount;
    case "semester":
      return section.semester?.jwId ?? null;
    case "course":
    case "coursename":
      return section.course.nameCn;
    case "code":
    case "sectioncode":
      return section.code;
    case "teacher":
      return section.teachers.length;
    case "campus":
      return section.campus?.nameCn ?? null;
    default:
      return undefined;
  }
}

/** Shared fixed section projection; transport parsers retain their own contracts. */
export function getDemoSectionList(
  locale: AppLocale,
  filters: Filters,
  { page, pageSize }: { page: number; pageSize: number },
) {
  const parsed = parseSectionSearchQuery(filters.search ?? "");
  const sections = getDemoSubscribedSections(locale).filter((section) =>
    matches(section, filters, parsed),
  );
  const sort = (filters.sort ?? parsed.sort ?? "").toLowerCase();
  const direction = (filters.order ?? parsed.order) === "desc" ? -1 : 1;
  sections.sort((a, b) => {
    const left = sortValue(a, sort),
      right = sortValue(b, sort);
    if (left === undefined || right === undefined)
      return (
        (b.semester?.jwId ?? 0) - (a.semester?.jwId ?? 0) || a.jwId - b.jwId
      );
    // PostgreSQL's default: NULLS LAST ascending, NULLS FIRST descending.
    const order =
      left === right
        ? 0
        : left === null
          ? 1
          : right === null
            ? -1
            : left < right
              ? -1
              : 1;
    return order * direction || a.jwId - b.jwId;
  });
  return buildPaginatedResponse(
    sections
      .slice((page - 1) * pageSize, page * pageSize)
      .map((section) => toSectionSummaryDto(section, locale)),
    page,
    pageSize,
    sections.length,
  );
}

export async function getDemoSectionListPage(url: URL, locale: AppLocale) {
  const params = normalizeCatalogListQuery(
    "/catalog/sections",
    url.searchParams,
  );
  const filters = catalogTableFilterValues("/catalog/sections", params);
  const messages = await getMessages(locale);
  const semesters = [
    ...new Map(
      getDemoSubscribedSections(locale).flatMap(({ semester }) =>
        semester ? [[semester.id, semester] as const] : [],
      ),
    ).values(),
  ].sort((a, b) => b.jwId - a.jwId);
  return {
    ...getDemoSectionList(locale, filters, {
      page: parsePositivePage(params.get("page")),
      pageSize: CATALOG_PAGE_SIZE,
    }),
    filters,
    // Only relationships already present in the shared fixture become options.
    filterOptions: {
      semesters,
      campuses: [],
      departments: [],
      categories: [],
      classTypes: [],
      educationLevels: [],
    },
    labels: {
      common: messages.common,
      sections: { ...messages.sections, close: messages.sectionDetail.close },
    },
  };
}
