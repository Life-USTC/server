# Web rendering and cache

Public, viewer-independent pages can be served from an anonymous HTML cache.
Signed-in, account, admin, and OAuth pages always use dynamic SSR with the
current viewer.

## Cacheable (anonymous only)

- Course / section / teacher list pages
- Catalog detail **root** paths (`/catalog/{courses|sections|teachers}/:id`)
- Mobile app, privacy, terms, Markdown guide, API docs

The bus map stays on dynamic SSR because its active-trip positions and current
time are request-sensitive. Its schedule and topology still use the shared
revision-scoped runtime cache.

Any recognized session or Bearer signal forces dynamic SSR. Pages that still
embed viewer-specific data (home, links planner, community) stay dynamic.

In-page catalog sections use hash anchors on the detail root; legacy path tabs
are not cache admission paths.

## Personalized shell overlay

Cached public HTML remains viewer-independent. After hydration, the app shell
uses the session-only `/_internal/shell-bootstrap` Web endpoint to resolve the
viewer and the workspace navigation counts that are not present in public SSR.
The response is always `private, no-store`, varies on `Cookie`, rejects Bearer
authentication, and is not part of the public REST/OpenAPI surface.

Workspace SSR already contains the same navigation projection. It seeds the
app shell's in-memory state directly, so the browser does not issue a duplicate
bootstrap request. The state survives client navigation for the lifetime of the
root layout only; it is not persisted in localStorage, KV, or another shared
cache.

## Cache layers and invalidation

Public SSR HTML passes through two independent caches:

| Layer | Driven by | Purged by |
| --- | --- | --- |
| Cloudflare zone/CDN | `Cloudflare-CDN-Cache-Control` | `POST /zones/{id}/purge_cache` by `Cache-Tag` |
| Workers entrypoint cache (`exports.PublicSsr.cache`) | `Cache-Control` | `cache.purge()` **inside `PublicSsr`** |

No zone-level purge — dashboard, API, or Terraform — affects Workers Caching
content, so the two purges are not interchangeable. A committed static import
runs both: the zone purge directly, and the entrypoint purge through the
authenticated `POST /_internal/edge-cache/purge` route, which hops into
`PublicSsr` over RPC. A failed purge fails the static-sync run rather than
leaving stale HTML cached for the rest of the TTL.

The stored representation keeps `max-age=0` so browsers always revalidate —
`personalizeCachedResponse` re-stamps a per-request nonce and request id on
every hit — and uses `s-maxage` for the shared-cache lifetime. A response with
only `max-age=0` is not storable by a shared cache at all.

`cache.cross_version_cache` stays off: entries are partitioned per Worker
version, so a deploy starts cold, and sharing entries across versions would
serve HTML rendered by an older version with no automatic invalidation.

## Contributor notes

- Don't put user-specific data into a payload you intend to cache anonymously.
- Catalog detail core reads use isolate L1 → per-colo Cache API → revision-scoped
  KV → origin. Cache API keys include the static-import revision, locale, entity
  kind, ID, and payload shape; the revision changes the key space when static
  data is rematerialized. Cache failures remain fail-open, and only validated
  non-null public objects are retained.
- Keep `/_internal` in the dynamic/private gateway roots even though the shell
  fetches JSON rather than HTML.
- Client navigation may warm route code on hover; data preload waits for
  tap/click (`docs` / `src/app.html` preload attributes — see
  `src/lib/components/AGENTS.md`).

Worker and Cache API implementation details live in code
(`src/worker.js`, `src/lib/cloudflare/`), not in this doc.
