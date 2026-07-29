# Web Rendering and Cache Boundary

Life@USTC uses an explicit boundary instead of deciding SSR versus CSR one
component at a time.

| Route class | Initial HTML | Viewer state | Shared HTML cache |
|-------------|--------------|--------------|-------------------|
| Public and viewer-independent | Anonymous SSR | Existing Better Auth session endpoint after hydration | Workers Cache named entrypoint |
| Canonical catalog detail without an auth signal or query | Anonymous SSR | Anonymous baseline; existing Better Auth session endpoint after hydration | Workers Cache named entrypoint |
| Public with page-specific viewer data, including catalog detail with an auth signal | SSR with the current viewer | Included by the page loader | Never |
| Account, workspace, admin, and OAuth | Authenticated SSR | Included by the page loader | Never |

The currently cacheable public set is intentionally explicit: the course,
section, and teacher list pages; canonical anonymous course, section, and
teacher detail pages; the bus map; mobile app, privacy, terms, Markdown guide,
and API documentation pages. Catalog detail cache admission requires a positive
decimal ID without leading zeroes, no query or trailing slash, and either the
base overview path or a supported tab. Course and teacher tabs are
`introduction`, `sections`, and `comments`; section tabs are `introduction`,
`calendar`, `exams`, `homework`, `teachers`, and `comments`. Any recognized
Bearer or session-cookie auth signal keeps the detail request on dynamic SSR.
Unknown paths outside known app route roots use a small script-free 404 response
without entering SvelteKit or the shared cache. Links, bus planner, community,
and home pages stay dynamic because they still contain page-specific viewer
behavior.

Catalog list cache admission also requires one value per query key and the
canonical non-empty value form. Empty controls emitted by the existing GET
filter forms are removed from the internal cache key. Page 1 is omitted; later
pages use a positive decimal up to 5,000. Search terms are trimmed and limited
to 256 characters, section text filters to 128 characters, and ID filters use
positive 32-bit decimals. Section sorts require an explicit `asc` or `desc`
order, and numeric filters use their canonical decimal form. Other
non-canonical requests continue through dynamic SSR, where the same
normalization bounds database input and runtime cache keys.

## Request flow

1. The default Worker entrypoint always receives the browser request. It
   rejects private routes, SvelteKit data requests, non-document requests, and
   unknown query fields before making a cached call. Catalog detail additionally
   rejects auth signals, every query, non-canonical IDs, trailing slashes, and
   unknown tabs; these requests continue through the normal dynamic Worker.
2. For an allowlisted page, it resolves the locale, removes Cookie and
   Authorization, canonicalizes allowlisted query fields, and adds the locale
   to an internal URL cache key.
3. The `PublicSsr` named entrypoint renders the anonymous SvelteKit document.
   Successful allowlisted pages are fresh for 60 seconds with a five-minute
   stale-while-revalidate window. `stale-if-error=0` is explicit because the
   Cloudflare default can otherwise serve an old successful response
   indefinitely when a refresh fails. Cache entries do not cross Worker
   versions, so a deployment invalidates the previous representation; normal
   catalog freshness is bounded by the short TTL and existing runtime data
   cache. Unknown routes instead return a small script-free, private/no-store
   response directly, so scanners do not render or hydrate the full application
   shell and cannot populate attacker-controlled high-cardinality cache keys.
4. The default entrypoint rewrites the cached CSP nonce placeholder and request
   ID for every browser response, then marks that outer response private and
   no-store so zone rules cannot bypass the gateway. Raw session headers never
   enter the cached call, and cached HTML never contains a user.
5. Hydration resolves the viewer through Better Auth's existing get-session
   route. The shell shows a stable skeleton until this completes, then reveals
   either signed-in navigation or the sign-in action. No new API endpoint is
   introduced. Direct dynamic SSR already knows the viewer state and does not
   repeat this client request.

Client navigation preloads route code on hover, but waits until tap/click intent
before preloading page data. This preserves code warming without issuing
uncached `__data.json` requests, authentication work, or database reads for
links that the visitor only moves across.

The generated SvelteKit Worker remains an internal build artifact selected by
`wrangler.adapter.jsonc`. Production and E2E use `src/worker.js` as the public
entrypoint, so direct requests cannot opt into internal cache headers.

## Adding a route

A route may enter the public cache allowlist when its full SSR payload is
viewer-independent, or when admission is limited to requests without a
recognized auth signal and the resulting SSR payload is a deterministic
anonymous baseline. Viewer-specific requests must keep using dynamic SSR unless
that state has moved behind an existing authenticated client request. Unknown
query fields must bypass the cache until they are reviewed and allowlisted.

The auth-signal detector is coupled to the Better Auth cookie configuration.
Changing Better Auth's cookie prefix or session-cookie name requires updating
the detector and its cache-boundary tests in the same change.
