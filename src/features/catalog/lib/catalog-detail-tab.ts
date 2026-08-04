export const CATALOG_DETAIL_TAB_QUERY = "tab";

export const catalogDetailTabs = [
  "overview",
  "introduction",
  "sections",
  "comments",
] as const;

export type CatalogDetailTab = (typeof catalogDetailTabs)[number];

const catalogDetailTabSet = new Set<string>(catalogDetailTabs);

const catalogDetailLegacyPathTab = /^(introduction|sections|comments)$/;

const catalogDetailHashByTab: Record<CatalogDetailTab, string> = {
  overview: "",
  introduction: "introduction",
  sections: "sections",
  comments: "comments",
};

export function isCatalogDetailLegacyPathTab(segment: string): boolean {
  return catalogDetailLegacyPathTab.test(segment);
}

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

export function catalogDetailHashForTab(tab: CatalogDetailTab) {
  const hash = catalogDetailHashByTab[tab];
  return hash ? `#${hash}` : "";
}

export function courseDetailPagePath(
  jwId: number | string,
  tab: CatalogDetailTab = "overview",
) {
  return `/catalog/courses/${jwId}${catalogDetailHashForTab(tab)}`;
}

export function teacherDetailPagePath(
  id: number | string,
  tab: CatalogDetailTab = "overview",
) {
  return `/catalog/teachers/${id}${catalogDetailHashForTab(tab)}`;
}

function appendSearchParamsPreserving(from: URL, to: URL) {
  for (const [key, value] of from.searchParams) {
    if (key === CATALOG_DETAIL_TAB_QUERY) continue;
    to.searchParams.append(key, value);
  }
}

export function resolveCatalogDetailTabRedirect(
  request: Request,
  kind: "courses" | "teachers",
) {
  if (request.method !== "GET" && request.method !== "HEAD") return null;

  const url = new URL(request.url);
  const match = new RegExp(`^/catalog/${kind}/([1-9]\\d*)/([^/]+)/?$`).exec(
    url.pathname,
  );
  if (!match) return null;

  const [, identifier, segment] = match;
  if (!isCatalogDetailLegacyPathTab(segment)) return null;

  const tab = parseCatalogDetailTab(segment);
  const redirectUrl = new URL(`/catalog/${kind}/${identifier}`, url.origin);
  appendSearchParamsPreserving(url, redirectUrl);
  return `${redirectUrl.pathname}${redirectUrl.search}${catalogDetailHashForTab(tab)}`;
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

  const tab = parseCatalogDetailTab(tabParam);
  const redirectUrl = new URL(url.pathname, url.origin);
  appendSearchParamsPreserving(url, redirectUrl);
  return `${redirectUrl.pathname}${redirectUrl.search}${catalogDetailHashForTab(tab)}`;
}
