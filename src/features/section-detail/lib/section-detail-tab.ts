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

export function sectionDetailTabSearch(tab: SectionDetailTab) {
  return tab === "overview" ? "" : `?${SECTION_DETAIL_TAB_QUERY}=${tab}`;
}

export function sectionDetailPagePath(
  jwId: number | string,
  tab: SectionDetailTab = "overview",
) {
  return `/catalog/sections/${jwId}${sectionDetailTabSearch(tab)}`;
}

export function sectionDetailHomeworkPath(
  jwId: number | string,
  options?: { homeworkId?: number | string },
) {
  const params = new URLSearchParams();
  params.set(SECTION_DETAIL_TAB_QUERY, "homework");
  if (options?.homeworkId != null) {
    params.set("homeworkId", String(options.homeworkId));
  }
  return `/catalog/sections/${jwId}?${params.toString()}`;
}

export function resolveSectionDetailTabRedirect(request: Request) {
  if (request.method !== "GET" && request.method !== "HEAD") return null;

  const url = new URL(request.url);
  const match = /^\/catalog\/sections\/([1-9]\d*)\/([^/]+)\/?$/.exec(
    url.pathname,
  );
  if (!match) return null;

  const [, jwId, segment] = match;
  if (!sectionDetailLegacyPathTab.test(segment)) return null;

  const redirectUrl = new URL(`/catalog/sections/${jwId}`, url.origin);
  for (const [key, value] of url.searchParams) {
    redirectUrl.searchParams.append(key, value);
  }
  redirectUrl.searchParams.set(SECTION_DETAIL_TAB_QUERY, segment);
  return `${redirectUrl.pathname}${redirectUrl.search}`;
}
