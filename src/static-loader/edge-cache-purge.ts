import { CATALOG_EDGE_CACHE_TAG } from "../lib/catalog-edge-cache-tag";
import {
  PUBLIC_SSR_CACHE_PURGE_ORIGIN_ENV,
  PUBLIC_SSR_CACHE_PURGE_PATH,
  PUBLIC_SSR_CACHE_PURGE_SECRET_ENV,
  PUBLIC_SSR_CACHE_PURGE_SECRET_HEADER,
} from "../lib/cloudflare/public-ssr-cache-purge-contract";

export { CATALOG_EDGE_CACHE_TAG };

export type EdgeCachePurgeResult =
  | { ok: true; skipped: false }
  | { ok: false; skipped: true };

/**
 * Purge both the zone/CDN and Workers entrypoint caches for public SSR HTML.
 *
 * The Worker owns the Cloudflare credentials and the entrypoint RPC, so the
 * importer only needs this authenticated internal route. Authentication follows
 * the `PUBLICATION_INGESTION_SECRET` idiom: a dedicated machine secret in a
 * dedicated header, never logged and never echoed.
 */
export async function purgePublicCatalogCaches(): Promise<EdgeCachePurgeResult> {
  const origin = process.env[PUBLIC_SSR_CACHE_PURGE_ORIGIN_ENV]?.trim();
  const secret = process.env[PUBLIC_SSR_CACHE_PURGE_SECRET_ENV]?.trim();
  if (!origin || !secret) {
    return { ok: false, skipped: true as const };
  }

  let response: Response;
  try {
    response = await fetch(
      new URL(PUBLIC_SSR_CACHE_PURGE_PATH, origin).toString(),
      {
        headers: { [PUBLIC_SSR_CACHE_PURGE_SECRET_HEADER]: secret },
        method: "POST",
      },
    );
  } catch {
    throw new Error("Public catalog cache purge request failed");
  }

  if (!response.ok) {
    throw new Error(
      `Public catalog cache purge failed (HTTP ${response.status})`,
    );
  }

  return { ok: true, skipped: false as const };
}
