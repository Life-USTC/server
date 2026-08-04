export const SECTION_DETAIL_TAB_QUERY = "tab";

export const sectionDetailTabs = [
  "overview",
  "introduction",
  "calendar",
  "exams",
  "homework",
  "teachers",
  "comments",
] as const;

export type SectionDetailTab = (typeof sectionDetailTabs)[number];

const sectionDetailTabSet = new Set<string>(sectionDetailTabs);

const sectionDetailLegacyPathTab =
  /^(introduction|calendar|exams|homework|teachers|comments)$/;

const sectionDetailHashByTab: Record<SectionDetailTab, string> = {
  overview: "",
  introduction: "introduction",
  calendar: "calendar",
  exams: "exams",
  homework: "homework",
  teachers: "teachers",
  comments: "comments",
};

export function isSectionDetailTab(
  value: string | null | undefined,
): value is SectionDetailTab {
  return value != null && sectionDetailTabSet.has(value);
}

export function parseSectionDetailTab(
  value: string | null | undefined,
): SectionDetailTab {
  return isSectionDetailTab(value) ? value : "overview";
}

export function sectionDetailHashForTab(tab: SectionDetailTab) {
  const hash = sectionDetailHashByTab[tab];
  return hash ? `#${hash}` : "";
}

/** Canonical section detail URL (no tab query). Optional hash for in-page anchors. */
export function sectionDetailPagePath(
  jwId: number | string,
  tab: SectionDetailTab = "overview",
) {
  return `/catalog/sections/${jwId}${sectionDetailHashForTab(tab)}`;
}

export function sectionDetailHomeworkPath(
  jwId: number | string,
  options?: { homeworkId?: number | string },
) {
  const params = new URLSearchParams();
  if (options?.homeworkId != null) {
    params.set("homeworkId", String(options.homeworkId));
  }
  const search = params.toString();
  return `/catalog/sections/${jwId}${search ? `?${search}` : ""}#homework`;
}

function appendSearchParamsPreserving(from: URL, to: URL) {
  for (const [key, value] of from.searchParams) {
    if (key === SECTION_DETAIL_TAB_QUERY) continue;
    to.searchParams.append(key, value);
  }
}

/** Legacy `/catalog/sections/[jwId]/{tab}` → root + hash (no `?tab=`). */
export function resolveSectionDetailTabRedirect(request: Request) {
  if (request.method !== "GET" && request.method !== "HEAD") return null;

  const url = new URL(request.url);
  const match = /^\/catalog\/sections\/([1-9]\d*)\/([^/]+)\/?$/.exec(
    url.pathname,
  );
  if (!match) return null;

  const [, jwId, segment] = match;
  if (!sectionDetailLegacyPathTab.test(segment)) return null;

  const tab = parseSectionDetailTab(segment);
  const redirectUrl = new URL(`/catalog/sections/${jwId}`, url.origin);
  appendSearchParamsPreserving(url, redirectUrl);
  return `${redirectUrl.pathname}${redirectUrl.search}${sectionDetailHashForTab(tab)}`;
}

/** Strip `?tab=` on the canonical section URL → optional hash. */
export function resolveSectionDetailTabQueryRedirect(request: Request) {
  if (request.method !== "GET" && request.method !== "HEAD") return null;

  const url = new URL(request.url);
  if (!/^\/catalog\/sections\/[1-9]\d*\/?$/.test(url.pathname)) return null;

  const tabParam = url.searchParams.get(SECTION_DETAIL_TAB_QUERY);
  if (!tabParam) return null;

  const tab = parseSectionDetailTab(tabParam);
  const redirectUrl = new URL(url.pathname, url.origin);
  appendSearchParamsPreserving(url, redirectUrl);
  return `${redirectUrl.pathname}${redirectUrl.search}${sectionDetailHashForTab(tab)}`;
}
