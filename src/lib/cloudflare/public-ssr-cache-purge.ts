/**
 * Invalidation for the Workers entrypoint cache in front of public SSR HTML.
 *
 * Two different caches sit in front of these responses:
 *
 * - the **zone/CDN cache**, driven by `Cloudflare-CDN-Cache-Control` and purged
 *   by `POST /zones/{zoneId}/purge_cache` (see
 *   `src/static-loader/edge-cache-purge.ts`);
 * - the **Workers entrypoint cache** (`exports.PublicSsr.cache` in
 *   `wrangler.jsonc`), driven by `Cache-Control` and *not* reachable by any
 *   zone-level purge. Cloudflare is explicit that no zone purge — dashboard,
 *   API, or Terraform — affects Workers Caching content.
 *
 * The only mechanism for the second cache is `ctx.cache.purge()`, and it is
 * scoped to the entrypoint that calls it. That is why the actual purge runs as
 * an RPC method on the `PublicSsr` entrypoint in `src/worker.js`. The
 * authenticated endpoint below invokes both cache purges so callers only need
 * the machine secret.
 */

import { timingSafeSecretEqual } from "@/lib/auth/secret-comparison";
import { CATALOG_EDGE_CACHE_TAG } from "@/lib/catalog-edge-cache-tag";
import { logAppEvent } from "@/lib/log/app-logger";
import {
  PUBLIC_SSR_CACHE_PURGE_PATH,
  PUBLIC_SSR_CACHE_PURGE_SECRET_ENV,
  PUBLIC_SSR_CACHE_PURGE_SECRET_HEADER,
} from "./public-ssr-cache-purge-contract";

export {
  PUBLIC_SSR_CACHE_PURGE_ORIGIN_ENV,
  PUBLIC_SSR_CACHE_PURGE_PATH,
  PUBLIC_SSR_CACHE_PURGE_SECRET_ENV,
  PUBLIC_SSR_CACHE_PURGE_SECRET_HEADER,
} from "./public-ssr-cache-purge-contract";

/**
 * The tag set is fixed rather than caller-supplied: the endpoint is a catalog
 * invalidation hook, not a general purge API, so an authenticated caller can
 * never widen it to `purgeEverything`.
 */
export const PUBLIC_SSR_CACHE_PURGE_TAGS = [CATALOG_EDGE_CACHE_TAG] as const;

export type PublicSsrCachePurgeFailureReason =
  | "cache-unavailable"
  | "purge-rejected"
  | "purge-threw";

export type PublicSsrCachePurgeResult =
  | { readonly ok: true; readonly tags: readonly string[] }
  | {
      readonly ok: false;
      readonly detail?: string;
      readonly reason: PublicSsrCachePurgeFailureReason;
    };

type EntrypointCacheContext = {
  purge(options: {
    pathPrefixes?: string[];
    purgeEverything?: boolean;
    tags?: string[];
  }): Promise<{
    errors?: readonly { code?: number; message?: string }[];
    success?: boolean;
  }>;
};

const MAX_DETAIL_LENGTH = 200;

function boundedDetail(value: string) {
  return value.slice(0, MAX_DETAIL_LENGTH);
}

function describeThrown(error: unknown) {
  if (error instanceof TypeError) return "TypeError";
  if (error instanceof Error) return "Error";
  return typeof error;
}

function summarizePurgeErrors(
  errors: readonly { code?: number; message?: string }[] | undefined,
) {
  if (!errors || errors.length === 0) return undefined;
  return boundedDetail(
    errors
      .map((error) =>
        typeof error.code === "number" && Number.isSafeInteger(error.code)
          ? String(error.code)
          : "unknown",
      )
      .join(","),
  );
}

export function isPublicSsrCachePurgeRequest(request: Request) {
  return new URL(request.url).pathname === PUBLIC_SSR_CACHE_PURGE_PATH;
}

function cloudflareCredential(env: unknown, name: string) {
  if (!env || typeof env !== "object") return undefined;
  const value = (env as Record<string, unknown>)[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export async function purgeCloudflareZoneCacheByTags(
  env: unknown,
  tags: readonly string[],
): Promise<PublicSsrCachePurgeResult> {
  const zoneId = cloudflareCredential(env, "CLOUDFLARE_ZONE_ID");
  const token = cloudflareCredential(env, "CLOUDFLARE_API_TOKEN");
  if (!zoneId || !token) return { ok: false, reason: "cache-unavailable" };
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tags: [...tags] }),
      },
    );
    const result = (await response.json()) as { success?: boolean };
    if (!response.ok || result.success !== true) {
      return { ok: false, reason: "purge-rejected" };
    }
    return { ok: true, tags: [...tags] };
  } catch {
    return { ok: false, reason: "purge-threw" };
  }
}

/**
 * Read the purge secret off the Worker `env` the fetch handler already has.
 * Worker secrets are bindings, so there is no need to go through the ambient
 * process/runtime env merge for this one.
 */
export function resolvePublicSsrCachePurgeSecret(env: unknown) {
  if (!env || typeof env !== "object") return undefined;
  const value = (env as Record<string, unknown>)[
    PUBLIC_SSR_CACHE_PURGE_SECRET_ENV
  ];
  if (typeof value !== "string") return undefined;
  return value.trim() || undefined;
}

/**
 * Run the purge against the calling entrypoint's cache. `cache` is optional on
 * `ExecutionContext`: it is absent unless the entrypoint declares
 * `cache.enabled`, so an unexpected `undefined` is reported rather than
 * silently treated as a successful no-op.
 */
export async function purgeEntrypointCatalogCache(
  cache: EntrypointCacheContext | undefined,
): Promise<PublicSsrCachePurgeResult> {
  if (!cache || typeof cache.purge !== "function") {
    return { ok: false, reason: "cache-unavailable" };
  }

  let result: Awaited<ReturnType<EntrypointCacheContext["purge"]>>;
  try {
    result = await cache.purge({ tags: [...PUBLIC_SSR_CACHE_PURGE_TAGS] });
  } catch (error) {
    return {
      detail: describeThrown(error),
      ok: false,
      reason: "purge-threw",
    };
  }

  if (result?.success !== true) {
    const detail = summarizePurgeErrors(result?.errors);
    return {
      ...(detail === undefined ? {} : { detail }),
      ok: false,
      reason: "purge-rejected",
    };
  }
  return { ok: true, tags: [...PUBLIC_SSR_CACHE_PURGE_TAGS] };
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: {
      "Cache-Control": "private, no-store",
      "Cloudflare-CDN-Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
    status,
  });
}

function unauthorized() {
  return jsonResponse(401, { error: "Unauthorized" });
}

/**
 * Authenticate the static loader with a dedicated machine secret, following
 * the `PUBLICATION_INGESTION_SECRET` idiom: a constant-time comparison, no
 * echo of either value, and a missing configuration that fails closed with the
 * same response as an invalid header.
 */
async function authorizePurgeRequest(request: Request, secret?: string) {
  if (!secret) return false;
  const candidate =
    request.headers.get(PUBLIC_SSR_CACHE_PURGE_SECRET_HEADER) ?? "";
  try {
    return await timingSafeSecretEqual(candidate, secret);
  } catch {
    return false;
  }
}

/**
 * A purge that fails while the shared cache holds a 24h representation is the
 * dangerous case: the catalog import has already committed, so the edge would
 * keep serving the previous HTML for the rest of the TTL. Log it at `error`
 * and answer with a non-2xx status so the caller's run fails visibly instead
 * of recording a successful import.
 */
export async function handlePublicSsrCachePurgeRequest(input: {
  purge: () => Promise<PublicSsrCachePurgeResult>;
  request: Request;
  secret?: string;
  zonePurge?: () => Promise<PublicSsrCachePurgeResult>;
}): Promise<Response> {
  if (!(await authorizePurgeRequest(input.request, input.secret))) {
    return unauthorized();
  }
  if (input.request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const zonePurge = input.zonePurge
    ? Promise.resolve()
        .then(input.zonePurge)
        .catch(
          (error): PublicSsrCachePurgeResult => ({
            detail: describeThrown(error),
            ok: false,
            reason: "purge-threw",
          }),
        )
    : undefined;

  let result: PublicSsrCachePurgeResult;
  let zoneResult: PublicSsrCachePurgeResult | undefined;
  try {
    [result, zoneResult] = await Promise.all([input.purge(), zonePurge]);
  } catch (error) {
    const detail = describeThrown(error);
    logAppEvent("error", "edge.cache.purge.error", {
      detail,
      event: "edge.cache.purge.error",
      outcome: "error",
      reason: "purge-threw",
      source: "worker-entrypoint",
    });
    return jsonResponse(502, {
      detail,
      error: "Cache purge failed",
      reason: "purge-threw",
    });
  }

  if (!result.ok) {
    logAppEvent("error", "edge.cache.purge.error", {
      ...(result.detail === undefined ? {} : { detail: result.detail }),
      event: "edge.cache.purge.error",
      outcome: "error",
      reason: result.reason,
      source: "worker-entrypoint",
    });
    return jsonResponse(result.reason === "cache-unavailable" ? 503 : 502, {
      error: "Cache purge failed",
      reason: result.reason,
    });
  }

  if (zoneResult && !zoneResult.ok) {
    logAppEvent("error", "edge.cache.purge.error", {
      ...(zoneResult.detail === undefined ? {} : { detail: zoneResult.detail }),
      event: "edge.cache.purge.error",
      outcome: "error",
      reason: zoneResult.reason,
      source: "cloudflare-zone",
    });
    return jsonResponse(zoneResult.reason === "cache-unavailable" ? 503 : 502, {
      error: "Cache purge failed",
      reason: zoneResult.reason,
    });
  }

  if (zoneResult?.ok) {
    logAppEvent("info", "edge.cache.purge.finish", {
      event: "edge.cache.purge.finish",
      outcome: "success",
      source: "cloudflare-zone",
      tags: zoneResult.tags.join(","),
    });
  }

  logAppEvent("info", "edge.cache.purge.finish", {
    event: "edge.cache.purge.finish",
    outcome: "success",
    source: "worker-entrypoint",
    tags: result.tags.join(","),
  });
  return jsonResponse(200, { purged: result.tags });
}
