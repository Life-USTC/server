import type { AppLocale } from "@/i18n/config";
import { getCatalogDetailCacheRevision } from "@/lib/catalog-detail-cache-revision";
import {
  PUBLIC_CATALOG_KV_CACHE_TTL_MS,
  PUBLIC_CATALOG_RUNTIME_CACHE_TTL_MS,
} from "@/lib/catalog-runtime-cache";
import {
  cachedPublicRuntimeData,
  type PublicDetailColoCacheKind,
  publicDetailColoCacheKey,
  publicDetailKvCacheKey,
} from "@/lib/public-runtime-cache";
import { getCanonicalOrigin } from "@/lib/site-url";

/** L1 isolate + colo Cache API TTL for anonymous catalog entity core. */
export const PUBLIC_DETAIL_RUNTIME_CACHE_TTL_MS =
  PUBLIC_CATALOG_RUNTIME_CACHE_TTL_MS;

/** Cross-PoP KV TTL; revision-scoped keys invalidate on static import. */
export const PUBLIC_DETAIL_KV_CACHE_TTL_MS = PUBLIC_CATALOG_KV_CACHE_TTL_MS;

export async function buildPublicDetailRuntimeCacheOptions<T>(input: {
  id: number;
  kind: PublicDetailColoCacheKind;
  kvShape: string;
  locale: AppLocale;
  origin?: string;
  shouldCacheResult?: (result: T) => boolean;
  validateColoCacheResult?: (result: unknown) => boolean;
}) {
  const revision = await getCatalogDetailCacheRevision();
  return {
    coloCacheKey: publicDetailColoCacheKey(
      input.origin ?? getCanonicalOrigin(),
      revision,
      input.kind,
      input.locale,
      input.id,
      input.kvShape,
    ),
    kvCacheKey: publicDetailKvCacheKey(
      revision,
      input.kind,
      input.locale,
      input.id,
      input.kvShape,
    ),
    kvTtlMs: PUBLIC_DETAIL_KV_CACHE_TTL_MS,
    shouldCacheResult: input.shouldCacheResult,
    validateColoCacheResult: input.validateColoCacheResult,
  };
}

function isPublicDetailResult(result: unknown) {
  return result !== null && typeof result === "object";
}

export async function cachedPublicDetailRuntimeData<T>(input: {
  id: number;
  kind: PublicDetailColoCacheKind;
  load: () => Promise<T | null>;
  locale: AppLocale;
  shape: string;
}) {
  const options = await buildPublicDetailRuntimeCacheOptions<T | null>({
    id: input.id,
    kind: input.kind,
    kvShape: input.shape,
    locale: input.locale,
    shouldCacheResult: isPublicDetailResult,
    validateColoCacheResult: isPublicDetailResult,
  });

  return cachedPublicRuntimeData(
    `catalog:${input.kind}-detail:${input.locale}`,
    options.kvCacheKey,
    PUBLIC_DETAIL_RUNTIME_CACHE_TTL_MS,
    input.load,
    options,
  );
}
