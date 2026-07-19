export const PUBLIC_CATALOG_CACHE_CONTROL =
  "public, max-age=0, s-maxage=60, stale-while-revalidate=300";

export const PUBLIC_LOCALE_CATALOG_HEADERS = {
  "Cache-Control": PUBLIC_CATALOG_CACHE_CONTROL,
  Vary: "Accept-Language, Cookie",
} as const;

export const PRIVATE_LOCALE_CATALOG_HEADERS = {
  "Cache-Control": "private, no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
  Vary: "Accept-Language, Cookie",
} as const;
