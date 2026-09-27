export function setPrivateCacheDefaults(headers: Headers) {
  // Cover JSON, redirects and early errors as well as HTML. Public routes
  // must opt in explicitly; an authenticated response must not be stored by
  // a CDN even if a route supplied a separate CDN caching directive.
  if (!headers.has("Cache-Control")) {
    headers.set("Cache-Control", "private, no-store");
  }
  if (
    /(?:^|,)\s*(?:private|no-store)(?:\s*(?:,|$)|=)/i.test(
      headers.get("Cache-Control") ?? "",
    )
  ) {
    headers.set("Cloudflare-CDN-Cache-Control", "no-store");
    if (/\bprivate\b/i.test(headers.get("Cache-Control") ?? "")) {
      headers.set("Cache-Control", "private, no-store");
    }
  }
}
