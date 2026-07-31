import type { GlobalSearchResponse } from "@/features/search/server/global-search-types";
import type { AppLocale } from "@/i18n/config";

const SEARCH_CACHE_TTL_MS = 120_000;
const MAX_SEARCH_CACHE_ENTRIES = 256;

type SearchCacheEntry = {
  expiresAt: number;
  value: GlobalSearchResponse;
};

const globalForSearchCache = globalThis as typeof globalThis & {
  __lifeUstcGlobalSearchCache?: Map<string, SearchCacheEntry>;
};

function searchCacheStore() {
  globalForSearchCache.__lifeUstcGlobalSearchCache ??= new Map();
  return globalForSearchCache.__lifeUstcGlobalSearchCache;
}

function searchCacheKey(
  locale: AppLocale,
  query: string,
  limit: number,
  userId: string | null | undefined,
) {
  return `${locale}:${userId ?? "anon"}:${limit}:${query}`;
}

export function readCachedGlobalSearch(
  locale: AppLocale,
  query: string,
  limit: number,
  userId: string | null | undefined,
) {
  const key = searchCacheKey(locale, query, limit, userId);
  const entry = searchCacheStore().get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    searchCacheStore().delete(key);
    return null;
  }
  return entry.value;
}

export function writeCachedGlobalSearch(
  locale: AppLocale,
  query: string,
  limit: number,
  userId: string | null | undefined,
  value: GlobalSearchResponse,
) {
  const store = searchCacheStore();
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) store.delete(key);
  }
  while (store.size >= MAX_SEARCH_CACHE_ENTRIES) {
    const oldestKey = store.keys().next().value;
    if (!oldestKey) break;
    store.delete(oldestKey);
  }
  store.set(searchCacheKey(locale, query, limit, userId), {
    expiresAt: now + SEARCH_CACHE_TTL_MS,
    value,
  });
}

export function resetGlobalSearchCacheForTest() {
  searchCacheStore().clear();
}
