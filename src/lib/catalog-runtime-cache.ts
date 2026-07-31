import type { AppLocale } from "@/i18n/config";
import { getCatalogDetailCacheRevision } from "@/lib/catalog-detail-cache-revision";
import { CATALOG_EDGE_CACHE_TAG } from "@/lib/catalog-edge-cache-tag";
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

export { CATALOG_EDGE_CACHE_TAG };

const PUBLIC_CATALOG_COLO_CACHE_PATH =
  "/_life-ustc-internal-cache/catalog-runtime/v1";

export function publicCatalogKvCacheKey(
  revision: string,
  namespace: string,
  cacheKey: string,
) {
  return `list:v1:${revision}:${namespace}:${cacheKey}`;
}

export function publicCatalogColoCacheKey(
  origin: string,
  namespace: string,
  cacheKey: string,
) {
  return new URL(
    `${PUBLIC_CATALOG_COLO_CACHE_PATH}/${encodeURIComponent(namespace)}/${encodeURIComponent(cacheKey)}`,
    origin,
  ).toString();
}

export async function buildPublicCatalogRuntimeCacheOptions(input: {
  cacheKey: string;
  namespace: PublicRuntimeCacheAnalyticsNamespace;
  origin: string;
}) {
  const revision = await getCatalogDetailCacheRevision();
  return {
    coloCacheKey: publicCatalogColoCacheKey(
      input.origin,
      input.namespace,
      input.cacheKey,
    ),
    kvCacheKey: publicCatalogKvCacheKey(
      revision,
      input.namespace,
      input.cacheKey,
    ),
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
  return cachedPublicRuntimeData(namespace, cacheKey, ttlMs, load, {
    ...(await buildPublicCatalogRuntimeCacheOptions({
      cacheKey,
      namespace,
      origin,
    })),
    shouldCacheResult: options.shouldCacheResult,
  });
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
  scope: "api" | "page",
): PublicRuntimeCacheAnalyticsNamespace {
  return `${scope}:${kind}-list:${locale}`;
}
