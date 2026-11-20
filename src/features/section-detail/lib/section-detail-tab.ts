export const SECTION_DETAIL_TAB_QUERY = "tab";

export const sectionDetailTabs = [
  "introduction",
  "calendar",
  "exams",
  "homework",
  "comments",
  "overview",
] as const;

export type SectionDetailTab = (typeof sectionDetailTabs)[number] | "teachers";

const sectionDetailTabSet = new Set<string>([...sectionDetailTabs, "teachers"]);

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

export function sectionDetailPagePath(
  jwId: number | string,
  tab?: SectionDetailTab,
) {
  return `/catalog/sections/${jwId}${tab === "teachers" ? "/overview#teachers" : tab ? `/${tab}` : ""}`;
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
  return `/catalog/sections/${jwId}/homework${search ? `?${search}` : ""}`;
}

function appendSearchParamsPreserving(from: URL, to: URL) {
  for (const [key, value] of from.searchParams) {
    if (key === SECTION_DETAIL_TAB_QUERY) continue;
    to.searchParams.append(key, value);
  }
}

export function resolveSectionDetailTabQueryRedirect(request: Request) {
  if (request.method !== "GET" && request.method !== "HEAD") return null;

  const url = new URL(request.url);
  if (!/^\/catalog\/sections\/[1-9]\d*\/?$/.test(url.pathname)) return null;

  const tabParam = url.searchParams.get(SECTION_DETAIL_TAB_QUERY);
  if (!tabParam) return null;

  const jwId = url.pathname.split("/")[3];
  const redirectUrl = new URL(
    sectionDetailPagePath(
      jwId,
      isSectionDetailTab(tabParam) ? tabParam : undefined,
    ),
    url.origin,
  );
  appendSearchParamsPreserving(url, redirectUrl);
  return redirectUrl.pathname + redirectUrl.search + redirectUrl.hash;
}
