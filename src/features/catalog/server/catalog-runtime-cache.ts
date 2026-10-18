import { getCatalogDetailCacheRevision } from "@/features/catalog/server/catalog-detail-cache-revision";
import type { AppLocale } from "@/i18n/config";
import { sha256Base64Url } from "@/lib/crypto/web-crypto";
import type { PublicRuntimeCacheAnalyticsNamespace } from "@/lib/metrics/analytics-engine";
import {
  cachedPublicRuntimeData,
  publicRuntimeCacheKey,
} from "@/lib/public-runtime-cache";

const HOUR_MS = 3_600_000;

/** L1 isolate + colo Cache API TTL for revision-scoped public catalog data. */
export const PUBLIC_CATALOG_RUNTIME_CACHE_TTL_MS = 24 * HOUR_MS;

/** Cross-PoP KV TTL for catalog list, metadata, search, and sitemap caches. */
export const PUBLIC_CATALOG_KV_CACHE_TTL_MS = 24 * HOUR_MS;

const PUBLIC_CATALOG_COLO_CACHE_PATH =
  "/_life-ustc-internal-cache/catalog-runtime/v2";

export async function buildPublicCatalogRuntimeCacheOptions(input: {
  cacheKey: string;
  namespace: PublicRuntimeCacheAnalyticsNamespace;
  origin: string;
}) {
  // Canonical filters can exceed KV's key limit, especially after Unicode
  // query encoding. Hash the complete key once for all three cache layers.
  const [revision, digest] = await Promise.all([
    getCatalogDetailCacheRevision(),
    sha256Base64Url(input.cacheKey),
  ]);
  return {
    coloCacheKey: new URL(
      `${PUBLIC_CATALOG_COLO_CACHE_PATH}/${encodeURIComponent(revision)}/${encodeURIComponent(input.namespace)}/${digest}`,
      input.origin,
    ).toString(),
    kvCacheKey: `list:v2:${revision}:${input.namespace}:${digest}`,
    kvTtlMs: PUBLIC_CATALOG_KV_CACHE_TTL_MS,
  };
}

export async function cachedCatalogRuntimeData<T>(
  namespace: PublicRuntimeCacheAnalyticsNamespace,
  cacheKey: string,
  origin: string,
  load: () => Promise<T>,
  options: {
    shouldCacheResult?: (result: T) => boolean;
    ttlMs?: number;
  } = {},
) {
  const ttlMs = options.ttlMs ?? PUBLIC_CATALOG_RUNTIME_CACHE_TTL_MS;
  const cacheOptions = await buildPublicCatalogRuntimeCacheOptions({
    cacheKey,
    namespace,
    origin,
  });
  return cachedPublicRuntimeData(
    namespace,
    cacheOptions.kvCacheKey,
    ttlMs,
    load,
    {
      ...cacheOptions,
      kvTtlMs: ttlMs,
      shouldCacheResult: options.shouldCacheResult,
    },
  );
}

export async function cachedCatalogListRuntimeData<T>(
  namespace: PublicRuntimeCacheAnalyticsNamespace,
  origin: string,
  searchParams: URLSearchParams,
  load: () => Promise<T>,
) {
  const cacheKey = publicRuntimeCacheKey(namespace, searchParams);
  return cachedCatalogRuntimeData(namespace, cacheKey, origin, load);
}

export function catalogListCacheNamespace(
  kind: "courses" | "sections" | "teachers",
  locale: AppLocale,
  scope: "page",
): PublicRuntimeCacheAnalyticsNamespace {
  return `${scope}:${kind}-list:${locale}`;
}
