import type { AppLocale } from "@/i18n/config";
import { getCatalogDetailCacheRevision } from "@/lib/catalog-detail-cache-revision";
import {
  PUBLIC_CATALOG_KV_CACHE_TTL_MS,
  PUBLIC_CATALOG_RUNTIME_CACHE_TTL_MS,
} from "@/lib/catalog-runtime-cache";
import {
  type PublicDetailColoCacheKind,
  publicDetailKvCacheKey,
} from "@/lib/public-runtime-cache";

/** L1 isolate + colo Cache API TTL for anonymous catalog entity core. */
export const PUBLIC_DETAIL_RUNTIME_CACHE_TTL_MS =
  PUBLIC_CATALOG_RUNTIME_CACHE_TTL_MS;

/** Cross-PoP KV TTL; revision-scoped keys invalidate on static import. */
export const PUBLIC_DETAIL_KV_CACHE_TTL_MS = PUBLIC_CATALOG_KV_CACHE_TTL_MS;

export async function buildPublicDetailRuntimeCacheOptions<T>(input: {
  coloCacheKey?: string;
  id: number;
  kind: PublicDetailColoCacheKind;
  kvShape: string;
  locale: AppLocale;
  shouldCacheResult?: (result: T) => boolean;
  validateColoCacheResult?: (result: unknown) => boolean;
}) {
  const revision = await getCatalogDetailCacheRevision();
  return {
    coloCacheKey: input.coloCacheKey,
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
