export const CATALOG_DETAIL_TAB_QUERY = "tab";

export const catalogDetailTabs = [
  "introduction",
  "sections",
  "comments",
  "overview",
] as const;

export type CatalogDetailTab = (typeof catalogDetailTabs)[number];

const catalogDetailTabSet = new Set<string>(catalogDetailTabs);

export function isCatalogDetailTab(
  value: string | null | undefined,
): value is CatalogDetailTab {
  return value != null && catalogDetailTabSet.has(value);
}

export function parseCatalogDetailTab(
  value: string | null | undefined,
): CatalogDetailTab {
  return isCatalogDetailTab(value) ? value : "overview";
}

export function courseDetailPagePath(
  jwId: number | string,
  tab?: CatalogDetailTab,
) {
  return `/catalog/courses/${jwId}${tab ? `/${tab}` : ""}`;
}

export function teacherDetailPagePath(
  id: number | string,
  tab?: CatalogDetailTab,
) {
  return `/catalog/teachers/${id}${tab ? `/${tab}` : ""}`;
}

function appendSearchParamsPreserving(from: URL, to: URL) {
  for (const [key, value] of from.searchParams) {
    if (key === CATALOG_DETAIL_TAB_QUERY) continue;
    to.searchParams.append(key, value);
  }
}

export function resolveCatalogDetailTabQueryRedirect(
  request: Request,
  kind: "courses" | "teachers",
) {
  if (request.method !== "GET" && request.method !== "HEAD") return null;

  const url = new URL(request.url);
  if (!new RegExp(`^/catalog/${kind}/[1-9]\\d*/?$`).test(url.pathname)) {
    return null;
  }

  const tabParam = url.searchParams.get(CATALOG_DETAIL_TAB_QUERY);
  if (!tabParam) return null;

  const path =
    url.pathname.replace(/\/$/, "") +
    (isCatalogDetailTab(tabParam) ? `/${tabParam}` : "");
  const redirectUrl = new URL(path, url.origin);
  appendSearchParamsPreserving(url, redirectUrl);
  return redirectUrl.pathname + redirectUrl.search;
}
