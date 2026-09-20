import { CATALOG_EDGE_CACHE_TAG } from "../lib/catalog-edge-cache-tag";
import {
  PUBLIC_SSR_CACHE_PURGE_ORIGIN_ENV,
  PUBLIC_SSR_CACHE_PURGE_PATH,
  PUBLIC_SSR_CACHE_PURGE_SECRET_ENV,
  PUBLIC_SSR_CACHE_PURGE_SECRET_HEADER,
} from "../lib/cloudflare/public-ssr-cache-purge-contract";

export { CATALOG_EDGE_CACHE_TAG };

const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4";
const MAX_ERROR_BODY_LENGTH = 500;

export type EdgeCachePurgeResult =
  | { ok: true; skipped: false }
  | { ok: false; skipped: true };

/**
 * Purge the Cloudflare **zone/CDN** cache by tag.
 *
 * This reaches only the responses cached by the zone, which is what
 * `Cloudflare-CDN-Cache-Control` targets. It does **not** reach the Workers
 * entrypoint cache (`exports.PublicSsr.cache` in `wrangler.jsonc`) that stores
 * public SSR HTML: Cloudflare documents that no zone-level purge — via the
 * dashboard, the API, or Terraform — affects Workers Caching content. The only
 * mechanism for that cache is `cache.purge()` from inside the owning
 * entrypoint, which this Node CLI cannot call at all.
 *
 * Use {@link purgeWorkerEntrypointCache} as well, never instead: the two calls
 * invalidate two different layers.
 */
export async function purgeCloudflareCacheByTags(
  tags: readonly string[],
): Promise<EdgeCachePurgeResult> {
  const zoneId = process.env.CLOUDFLARE_ZONE_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (!zoneId || !apiToken || tags.length === 0) {
    return { ok: false, skipped: true as const };
  }

  const response = await fetch(
    `${CLOUDFLARE_API_BASE}/zones/${zoneId}/purge_cache`,
    {
      body: JSON.stringify({ tags: [...tags] }),
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Cloudflare cache purge failed (${response.status}): ${body.slice(
        0,
        MAX_ERROR_BODY_LENGTH,
      )}`,
    );
  }

  return { ok: true, skipped: false as const };
}

/**
 * Purge the Workers entrypoint cache that fronts public SSR HTML.
 *
 * The purge itself has to run inside the `PublicSsr` entrypoint, so this posts
 * to the Worker's authenticated internal route, which hops there over RPC.
 * Authentication follows the `PUBLICATION_INGESTION_SECRET` idiom: a dedicated
 * machine secret in a dedicated header, never logged and never echoed.
 */
export async function purgeWorkerEntrypointCache(): Promise<EdgeCachePurgeResult> {
  const origin = process.env[PUBLIC_SSR_CACHE_PURGE_ORIGIN_ENV]?.trim();
  const secret = process.env[PUBLIC_SSR_CACHE_PURGE_SECRET_ENV]?.trim();
  if (!origin || !secret) {
    return { ok: false, skipped: true as const };
  }

  const response = await fetch(
    new URL(PUBLIC_SSR_CACHE_PURGE_PATH, origin).toString(),
    {
      headers: { [PUBLIC_SSR_CACHE_PURGE_SECRET_HEADER]: secret },
      method: "POST",
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Worker entrypoint cache purge failed (${response.status}): ${body.slice(
        0,
        MAX_ERROR_BODY_LENGTH,
      )}`,
    );
  }

  return { ok: true, skipped: false as const };
}
