# Web Rendering and Cache Boundary

Life@USTC uses an explicit boundary instead of deciding SSR versus CSR one
component at a time.

| Route class | Initial HTML | Viewer state | Shared HTML cache |
|-------------|--------------|--------------|-------------------|
| Public and viewer-independent | Anonymous SSR | Existing Better Auth session endpoint after hydration | Workers Cache named entrypoint |
| Public with page-specific viewer data | SSR with the current viewer | Included by the page loader | No store until that viewer data has a client overlay |
| Account, workspace, admin, and OAuth | Authenticated SSR | Included by the page loader | Never |

The currently cacheable public set is intentionally explicit: the course,
section, and teacher list pages; the bus map; mobile app, privacy, terms,
Markdown guide, and API documentation pages. Unknown paths outside known app
route roots use the same path only when the result is a 404. Public detail,
links, bus planner, community, and home pages stay dynamic because they still
contain page-specific viewer behavior.

## Request flow

1. The default Worker entrypoint always receives the browser request. It
   rejects private routes, SvelteKit data requests, non-document requests, and
   unknown query fields before making a cached call.
2. For an allowlisted page, it resolves the locale, removes Cookie and
   Authorization, canonicalizes allowlisted query fields, and adds the locale
   to an internal URL cache key.
3. The `PublicSsr` named entrypoint renders the anonymous SvelteKit document.
   Successful allowlisted pages are fresh for 60 seconds with a five-minute
   stale-while-revalidate window. Confirmed unknown 404s are fresh for five
   minutes with a one-hour stale window. Cache entries do not cross Worker
   versions, so a deployment invalidates the previous representation; normal
   catalog freshness is bounded by the short TTL and existing runtime data
   cache. Confirmed 404s are replaced with a small script-free document before
   they are stored, so scanners and browsers do not download or hydrate the
   full application shell.
4. The default entrypoint rewrites the cached CSP nonce placeholder and request
   ID for every browser response, then marks that outer response private and
   no-store so zone rules cannot bypass the gateway. Raw session headers never
   enter the cached call, and cached HTML never contains a user.
5. Hydration resolves the viewer through Better Auth's existing get-session
   route. The shell shows a stable skeleton until this completes, then reveals
   either signed-in navigation or the sign-in action. No new API endpoint is
   introduced. Direct dynamic SSR already knows the viewer state and does not
   repeat this client request.

The generated SvelteKit Worker remains an internal build artifact selected by
`wrangler.adapter.jsonc`. Production and E2E use `src/worker.js` as the public
entrypoint, so direct requests cannot opt into internal cache headers.

## Adding a route

A route may enter the public cache allowlist only when its full SSR payload is
identical for anonymous and signed-in visitors. If a page has viewer-specific
controls or data, first move that state behind an existing authenticated client
request and render a deterministic anonymous/skeleton baseline. Unknown query
fields must bypass the cache until they are reviewed and allowlisted.
