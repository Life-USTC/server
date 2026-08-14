import type { GlobalSearchResponse } from "@/features/search/server/global-search-types";
import type { AppLocale } from "@/i18n/config";

export const GLOBAL_SEARCH_MIN_QUERY_LENGTH = 2;
export const GLOBAL_SEARCH_DEBOUNCE_MS = 200;
export const GLOBAL_SEARCH_DIALOG_LIMIT = 5;
export const GLOBAL_SEARCH_PAGE_LIMIT = 20;

export async function fetchGlobalSearch(
  query: string,
  limit: number,
  options: {
    includeWorkspace?: boolean;
    locale: AppLocale;
  },
): Promise<GlobalSearchResponse> {
  const searchParams = new URLSearchParams({
    q: query,
    limit: String(limit),
    locale: options.locale,
  });
  if (options.includeWorkspace) {
    searchParams.set("scope", "workspace");
  }
  const response = await fetch(`/api/search?${searchParams}`);
  if (!response.ok) {
    throw new Error("Search request failed");
  }
  return (await response.json()) as GlobalSearchResponse;
}
