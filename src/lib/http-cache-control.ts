/**
 * The one private form a client may store. `max-age=0, must-revalidate` forces
 * an origin round trip before any stored copy is served, so the origin
 * re-authorizes every read. A route that serves a stable `ETag` opts into it so
 * a conditional request can answer 304 instead of resending the body, which
 * `no-store` prevents by stopping the client from sending the condition at all.
 * Shared caches stay excluded through the CDN directive below.
 */
export const REVALIDATED_PRIVATE_CACHE_CONTROL =
  "private, max-age=0, must-revalidate";

export function setPrivateCacheDefaults(headers: Headers) {
  // Cover JSON, redirects and early errors as well as HTML. Public routes
  // must opt in explicitly; an authenticated response must not be stored by
  // a CDN even if a route supplied a separate CDN caching directive.
  if (!headers.has("Cache-Control")) {
    headers.set("Cache-Control", "private, no-store");
  }
  const cacheControl = headers.get("Cache-Control") ?? "";
  if (/(?:^|,)\s*(?:private|no-store)(?:\s*(?:,|$)|=)/i.test(cacheControl)) {
    headers.set("Cloudflare-CDN-Cache-Control", "no-store");
    if (
      /\bprivate\b/i.test(cacheControl) &&
      cacheControl !== REVALIDATED_PRIVATE_CACHE_CONTROL
    ) {
      headers.set("Cache-Control", "private, no-store");
    }
  }
}
