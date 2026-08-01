import {
  parseSectionDetailTab,
  SECTION_DETAIL_TAB_QUERY,
} from "@/features/section-detail/lib/section-detail-tab";

export type PageSsrClass = "dynamic-ssr" | "public-ssr";

export type PageAuthSignalPresence = "absent" | "present";

export type PageCatalogDetailTab =
  | "calendar"
  | "comments"
  | "exams"
  | "homework"
  | "introduction"
  | "not_applicable"
  | "overview"
  | "sections"
  | "teachers";

const COURSE_TEACHER_DETAIL_TABS = new Set([
  "comments",
  "introduction",
  "overview",
  "sections",
]);

const SECTION_DETAIL_ROUTE = "/catalog/sections/[jwId]";
const SECTION_DETAIL_SECTION_ROUTE = "/catalog/sections/[jwId]/[section]";
const COURSE_DETAIL_ROUTE = "/catalog/courses/[jwId]";
const COURSE_DETAIL_SECTION_ROUTE = "/catalog/courses/[jwId]/[section]";
const TEACHER_DETAIL_ROUTE = "/catalog/teachers/[id]";
const TEACHER_DETAIL_SECTION_ROUTE = "/catalog/teachers/[id]/[section]";

export function classifyPageSsrClass(publicSsr: boolean): PageSsrClass {
  return publicSsr ? "public-ssr" : "dynamic-ssr";
}

export function classifyPageAuthSignalPresence(
  hasAuthSignal: boolean,
): PageAuthSignalPresence {
  return hasAuthSignal ? "present" : "absent";
}

function resolveCourseTeacherDetailTab(
  section: string | undefined,
): PageCatalogDetailTab {
  if (!section) return "overview";
  return COURSE_TEACHER_DETAIL_TABS.has(section)
    ? (section as PageCatalogDetailTab)
    : "not_applicable";
}

export function resolvePageCatalogDetailTab(
  routeId: string | null,
  url: URL,
  params: Record<string, string> = {},
): PageCatalogDetailTab {
  if (!routeId) return "not_applicable";

  if (routeId === SECTION_DETAIL_ROUTE) {
    return parseSectionDetailTab(
      url.searchParams.get(SECTION_DETAIL_TAB_QUERY),
    );
  }

  if (routeId === SECTION_DETAIL_SECTION_ROUTE) {
    return parseSectionDetailTab(params.section);
  }

  if (routeId === COURSE_DETAIL_ROUTE || routeId === TEACHER_DETAIL_ROUTE) {
    return "overview";
  }

  if (
    routeId === COURSE_DETAIL_SECTION_ROUTE ||
    routeId === TEACHER_DETAIL_SECTION_ROUTE
  ) {
    return resolveCourseTeacherDetailTab(params.section);
  }

  return "not_applicable";
}
