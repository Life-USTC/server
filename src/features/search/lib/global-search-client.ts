import type { GlobalSearchResponse } from "@/features/search/server/global-search-types";

export const GLOBAL_SEARCH_MIN_QUERY_LENGTH = 2;
export const GLOBAL_SEARCH_DEBOUNCE_MS = 200;
export const GLOBAL_SEARCH_DIALOG_LIMIT = 5;
export const GLOBAL_SEARCH_PAGE_LIMIT = 20;

export async function fetchGlobalSearch(
  query: string,
  limit: number,
): Promise<GlobalSearchResponse> {
  const response = await fetch(
    `/api/search?q=${encodeURIComponent(query)}&limit=${limit}`,
  );
  if (!response.ok) {
    throw new Error("Search request failed");
  }
  return (await response.json()) as GlobalSearchResponse;
}
