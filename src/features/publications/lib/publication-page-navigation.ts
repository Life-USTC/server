import type { PublicationListFilters } from "../components/publication-component-types";

export function publicationListHref(filters: PublicationListFilters, page = 1) {
  const params = new URLSearchParams();
  if (filters.type) params.set("type", filters.type);
  if (filters.source?.length) params.set("source", filters.source.join(","));
  if (filters.organizationLevel?.length) {
    params.set("organizationLevel", filters.organizationLevel.join(","));
  }
  if (filters.query) params.set("query", filters.query);
  if (filters.fold) params.set("fold", "1");
  if (page > 1) params.set("page", String(page));
  return params.size ? `/news?${params}` : "/news";
}

/** Only the public list can be a detail page's return destination. */
export function publicationReturnHref(from: string | null) {
  if (!from || (from !== "/news" && !from.startsWith("/news?"))) return "/news";
  const target = new URL(from, "https://publication.invalid");
  if (target.pathname !== "/news") return "/news";
  return `${target.pathname}${target.search}`;
}

export function publicationDetailHref(id: string, from: string) {
  const params = new URLSearchParams({ from: publicationReturnHref(from) });
  return `/news/${encodeURIComponent(id)}?${params}`;
}
