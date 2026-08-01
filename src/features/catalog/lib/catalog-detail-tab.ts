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

export function catalogDetailTabSearch(tab: CatalogDetailTab) {
  return tab === "overview" ? "" : `?${CATALOG_DETAIL_TAB_QUERY}=${tab}`;
}

export function courseDetailPagePath(
  jwId: number | string,
  tab: CatalogDetailTab = "overview",
) {
  return `/catalog/courses/${jwId}${catalogDetailTabSearch(tab)}`;
}

export function teacherDetailPagePath(
  id: number | string,
  tab: CatalogDetailTab = "overview",
) {
  return `/catalog/teachers/${id}${catalogDetailTabSearch(tab)}`;
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
  if (!catalogDetailLegacyPathTab.test(segment)) return null;

  const redirectUrl = new URL(`/catalog/${kind}/${identifier}`, url.origin);
  for (const [key, value] of url.searchParams) {
    redirectUrl.searchParams.append(key, value);
  }
  redirectUrl.searchParams.set(CATALOG_DETAIL_TAB_QUERY, segment);
  return `${redirectUrl.pathname}${redirectUrl.search}`;
}
