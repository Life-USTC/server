import { CATALOG_EDGE_CACHE_TAG } from "@/lib/catalog-runtime-cache";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";

const HOUR_SECONDS = 3_600;

export const PUBLIC_CATALOG_CACHE_CONTROL =
  "public, max-age=0, stale-while-revalidate=300";

export const PUBLIC_CATALOG_CDN_CACHE_CONTROL = `public, max-age=${24 * HOUR_SECONDS}, stale-while-revalidate=300`;

export const PUBLIC_CATALOG_HEADERS = {
  "Cache-Control": PUBLIC_CATALOG_CACHE_CONTROL,
  "Cache-Tag": CATALOG_EDGE_CACHE_TAG,
  "Cloudflare-CDN-Cache-Control": PUBLIC_CATALOG_CDN_CACHE_CONTROL,
} as const;

export function currentSemesterCacheHeaders(referenceDate: Date) {
  const now = shanghaiDayjs(referenceDate);
  const secondsUntilNextShanghaiDay = Math.max(
    1,
    now.add(1, "day").startOf("day").diff(now, "second"),
  );
  return {
    "Cache-Control": "public, max-age=0",
    "Cache-Tag": CATALOG_EDGE_CACHE_TAG,
    "Cloudflare-CDN-Cache-Control": `public, max-age=${secondsUntilNextShanghaiDay}`,
  } as const;
}

export const PUBLIC_SEARCH_CACHE_HEADERS = {
  "Cache-Control":
    "public, max-age=0, s-maxage=120, stale-while-revalidate=300",
  "Cache-Tag": CATALOG_EDGE_CACHE_TAG,
  "Cloudflare-CDN-Cache-Control":
    "public, max-age=120, stale-while-revalidate=300",
} as const;

// Bus schedule responses are purged with the catalog revision tag. Keep the
// edge TTL shorter than the catalog TTL so an effective-version date boundary
// cannot leave the previous schedule cached for a full day.
export const PUBLIC_BUS_CACHE_HEADERS = {
  "Cache-Control":
    "public, max-age=0, s-maxage=3600, stale-while-revalidate=300",
  "Cache-Tag": CATALOG_EDGE_CACHE_TAG,
  "Cloudflare-CDN-Cache-Control":
    "public, max-age=3600, stale-while-revalidate=300",
  Vary: "Accept-Language, Cookie",
} as const;

export const TIME_SENSITIVE_PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
  Vary: "Accept-Language, Cookie",
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
