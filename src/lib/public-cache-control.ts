export const PUBLIC_CATALOG_CACHE_CONTROL =
  "public, max-age=0, stale-while-revalidate=300";

export const PUBLIC_CATALOG_CDN_CACHE_CONTROL =
  "public, max-age=60, stale-while-revalidate=300";

export const PUBLIC_CATALOG_HEADERS = {
  "Cache-Control": PUBLIC_CATALOG_CACHE_CONTROL,
  "Cloudflare-CDN-Cache-Control": PUBLIC_CATALOG_CDN_CACHE_CONTROL,
} as const;

export const PUBLIC_LOCALE_CATALOG_HEADERS = {
  ...PUBLIC_CATALOG_HEADERS,
  Vary: "Accept-Language, Cookie",
} as const;

export const PRIVATE_LOCALE_CATALOG_HEADERS = {
  "Cache-Control": "private, no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
  Vary: "Accept-Language, Cookie",
} as const;

// HTML page variant: no stale-while-revalidate for the browser. Browsers may
// serve an SWR-cached document without revalidating, which breaks flows that
// mutate state and expect a fresh render on the next navigation (locale
// switch, login, subscribe). The edge keeps its own SWR window.
export const PUBLIC_LOCALE_CATALOG_PAGE_HEADERS = {
  "Cache-Control": "public, max-age=0",
  "Cloudflare-CDN-Cache-Control": PUBLIC_CATALOG_CDN_CACHE_CONTROL,
  Vary: "Accept-Language, Cookie",
} as const;
