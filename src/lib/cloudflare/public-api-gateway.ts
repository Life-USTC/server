/**
 * Decides which public catalog JSON responses may be stored in the shared
 * Workers entrypoint cache. This is the JSON sibling of the HTML rules in
 * `public-ssr-gateway.ts` and it deliberately stores through the *same*
 * `PublicSsr` entrypoint, because `ctx.cache.purge()` only reaches the
 * entrypoint that stored a representation: one `Cache-Tag: catalog` purge then
 * invalidates the HTML and the JSON together.
 * See docs/policies/rendering-and-cache.yaml for the product rules.
 */
import { CATALOG_EDGE_CACHE_TAG } from "@/lib/catalog-edge-cache-tag";
import {
  PUBLIC_CATALOG_CACHE_CONTROL,
  PUBLIC_CATALOG_CDN_CACHE_CONTROL,
  PUBLIC_CATALOG_CDN_MAX_AGE_SECONDS,
} from "@/lib/public-cache-control";

/** Marks the cache key and the entrypoint dispatch as the JSON variant. */
export const PUBLIC_CATALOG_API_CACHE_MODE = "api";

export type PublicCatalogApiCacheMode = typeof PUBLIC_CATALOG_API_CACHE_MODE;

/**
 * `Cache-Control` stored with the shared public catalog JSON representation.
 *
 * `PUBLIC_CATALOG_HEADERS` declares `max-age=0` with no `s-maxage`, so the
 * shared freshness lifetime of the route's own response is zero and the
 * entrypoint cache refuses to store it at all — which is why `/api/catalog/*`
 * reports no `Cf-Cache-Status` today even though it already advertises a 24h
 * `Cloudflare-CDN-Cache-Control`. Mirror `PUBLIC_SSR_BROWSER_CACHE_CONTROL`
 * and carry the shared lifetime as `s-maxage`, then restore the route's own
 * policy on the way out so the contract clients see does not change.
 *
 * The lifetime is only safe because a committed catalog import purges this
 * cache by tag — see `src/lib/cloudflare/public-ssr-cache-purge.ts`.
 */
export const PUBLIC_CATALOG_API_STORED_CACHE_CONTROL = `public, max-age=0, s-maxage=${PUBLIC_CATALOG_CDN_MAX_AGE_SECONDS}, stale-while-revalidate=300, stale-if-error=0`;

/**
 * Request headers dropped before the cached subrequest reaches the app.
 *
 * This is the primary safety property of the JSON cache: the stored body is
 * rendered from a request that carries no viewer credential and no language
 * negotiation at all, so it cannot depend on anything outside the method, the
 * path and the canonical query that make up the cache key. `accept-language`
 * is included because `hooks.server.ts` negotiates `locals.locale` from it;
 * public catalog JSON takes its locale only from `?locale=`, which *is* part
 * of the key.
 */
export const PUBLIC_CATALOG_API_STRIPPED_REQUEST_HEADERS = [
  "accept-encoding",
  "accept-language",
  "authorization",
  "cookie",
] as const;

/**
 * Viewer-independent public catalog JSON routes.
 *
 * Every entry resolves its locale through `resolvePublicCatalogLocale`
 * (`?locale=` only) or takes no locale, reads no session, and answers with
 * `PUBLIC_CATALOG_HEADERS`. Deliberately excluded:
 *
 * - `bus`, `bus/next`, `bus/routes` and `weather` — request-time data whose
 *   freshness window is far shorter than the catalog lifetime, and which carry
 *   their own cache header sets;
 * - `semesters/current` and `rooms/:code/map` — bespoke, shorter TTLs;
 * - `young-events*` and `young-organizers*` — the Young list body carries a
 *   `meta.source` freshness flag derived from `Date.now()`, and the matching
 *   HTML caps its shared lifetime at 60 seconds;
 * - `sections/match-codes` (POST) and the `.ics` feeds and image routes, which
 *   are not JSON at all.
 */
const PUBLIC_CATALOG_API_PATHS = new Set([
  "/api/catalog/courses",
  "/api/catalog/links",
  "/api/catalog/metadata",
  "/api/catalog/schedules",
  "/api/catalog/sections",
  "/api/catalog/semesters",
  "/api/catalog/teachers",
]);

const PUBLIC_CATALOG_API_DETAIL_PATH =
  /^\/api\/catalog\/(?:courses|teachers)\/[1-9]\d*$/;
const PUBLIC_CATALOG_API_SECTION_PATH =
  /^\/api\/catalog\/sections\/[1-9]\d*(?:\/(?:schedule-groups|schedules))?$/;

export function isViewerIndependentPublicCatalogApiPath(pathname: string) {
  return (
    PUBLIC_CATALOG_API_PATHS.has(pathname) ||
    PUBLIC_CATALOG_API_DETAIL_PATH.test(pathname) ||
    PUBLIC_CATALOG_API_SECTION_PATH.test(pathname)
  );
}

/**
 * Whether a request may be dispatched through the shared JSON cache at all.
 *
 * A bearer token never shares a representation, mirroring
 * `shouldRoutePublicSsrCache`. A session cookie does, because the cached
 * subrequest drops it and these routes resolve nothing from it.
 */
export function resolvePublicCatalogApiCacheMode(
  request: Request,
): PublicCatalogApiCacheMode | null {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  if (request.headers.has("authorization")) return null;
  return isViewerIndependentPublicCatalogApiPath(new URL(request.url).pathname)
    ? PUBLIC_CATALOG_API_CACHE_MODE
    : null;
}

/** `Vary` values a shared representation may carry; `Origin` is not viewer state. */
const STORABLE_VARY_FIELDS = new Set(["origin"]);

function hasStorableVary(response: Response) {
  const vary = response.headers.get("Vary");
  if (vary === null) return true;
  return vary
    .split(",")
    .map((field) => field.trim().toLowerCase())
    .filter((field) => field.length > 0)
    .every((field) => STORABLE_VARY_FIELDS.has(field));
}

/**
 * Admit a rendered response to shared storage.
 *
 * The signal is positive: the route author chose `PUBLIC_CATALOG_HEADERS` for
 * this response, so admission follows a decision made in the handler rather
 * than an inference from its URL. Anything that negotiated a different policy
 * — a private header set, a bespoke TTL, a validation error, a session cookie
 * refresh, a non-JSON body, or a `Vary` on viewer state — is not stored.
 */
export function cacheablePublicCatalogApiResponse(response: Response) {
  return (
    response.status === 200 &&
    !response.headers.has("set-cookie") &&
    (response.headers.get("content-type")?.includes("application/json") ??
      false) &&
    response.headers.get("Cache-Control") === PUBLIC_CATALOG_CACHE_CONTROL &&
    response.headers.get("Cloudflare-CDN-Cache-Control") ===
      PUBLIC_CATALOG_CDN_CACHE_CONTROL &&
    response.headers.get("Cache-Tag") === CATALOG_EDGE_CACHE_TAG &&
    hasStorableVary(response)
  );
}

/**
 * Whether a response came back as an admitted shared representation.
 *
 * The internal `s-maxage` is the marker. A response that was dispatched but
 * never admitted keeps whatever policy its handler chose, so it is delivered
 * untouched instead of being restamped as public.
 */
export function isStoredPublicCatalogApiRepresentation(response: Response) {
  return (
    response.headers.get("Cache-Control") ===
    PUBLIC_CATALOG_API_STORED_CACHE_CONTROL
  );
}
