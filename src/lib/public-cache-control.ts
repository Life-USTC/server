export const PUBLIC_CATALOG_CACHE_CONTROL =
  "public, max-age=0, s-maxage=60, stale-while-revalidate=300";

export const PUBLIC_LOCALE_CATALOG_HEADERS = {
  "Cache-Control": PUBLIC_CATALOG_CACHE_CONTROL,
  Vary: "Accept-Language, Cookie",
} as const;
