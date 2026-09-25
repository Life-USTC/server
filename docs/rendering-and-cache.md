# Web rendering and cache

Public content is independent of the viewer. Canonical public pages serve the
same anonymous HTML representation to visitors with or without a session;
personal data is fetched after hydration through private endpoints.

## Cacheable public pages

- Course / section / teacher lists with canonical filters
- Catalog detail root paths (`/catalog/{courses|sections|teachers}/:id`)
- Campus links
- Second-classroom lists, details, calendars, and organizers without query parameters
- Usage guides, privacy, terms, Markdown guide, and API docs
- Sign-in without query parameters, for anonymous visitors only

Account, workspace, admin, OAuth, and Bearer requests use dynamic SSR. Sign-in
with session cookies also remains dynamic so its redirect behavior is preserved.
SvelteKit `__data.json` navigations stay private; their public reads still reuse
the shared data caches. Filtered second-classroom pages reuse the public data
cache even when their HTML is dynamic.

Bus pages remain dynamic because departures and map positions are sensitive to
the request time. Shared schedule/topology reads remain cached, and personal
preferences are fetched separately. News and global-search pages remain dynamic.
The homepage preserves its signed-in redirect to the workspace.

## Personal overlays

Public SSR never includes subscription state, homework completion, edit
permissions, link pins/visits, or bus preferences. Feature components load that
state from private APIs and wait for the result before enabling personal writes.
The publicly readable description remains in the HTML and structured data;
its editing permissions are resolved separately.

The app shell uses the session-only `/_internal/shell-bootstrap` endpoint for
the viewer and workspace navigation counts. Workspace SSR seeds the same
projection directly. Feature components use their own APIs rather than fetching
the complete shell just to discover identity. Shell state lives only in the root
layout's memory; it is not persisted in localStorage or a shared cache.

JSON responses default to `private, no-store`, including validation and auth
errors. Public APIs opt into caching explicitly and must remain independent of
session/Bearer identity. The HTTP boundary also sets CDN `no-store` for private
responses. `/_internal` endpoints stay outside public cache admission.

## Cache layers and invalidation

| Layer | Content | Invalidation |
| --- | --- | --- |
| Workers entrypoint (`PublicSsr`) | Anonymous HTML before nonce rewriting | RPC into `PublicSsr` calls `cache.purge()` |
| Zone/CDN and Cache API | Eligible public API responses / public data | Zone purge by catalog tag; revision-scoped data keys |
| Isolate L1 / KV | Public catalog data | Revision-scoped keys |

Final HTML responses sent to the browser and zone CDN are `private, no-store`:
a new nonce and request ID are applied on every request. The stored entrypoint
representation uses `max-age=0` plus a shared `s-maxage`. Most public HTML has a
24-hour shared lifetime. Second-classroom HTML has at most 60 seconds; calendar
seeds expire at the next Shanghai midnight without stale-while-revalidate.

A committed static import purges both the zone and Workers entrypoint layers.
A failed purge fails the sync; rerunning the same already-committed snapshot
retries the purge. The current revision is memoized only within a request, so an
old isolate revision cannot refill freshly purged HTML for another 24 hours.
Description edits and moderation invalidate the HTML after the database commit,
including retries that submit the same description content.

`cache.cross_version_cache` stays off, so deployments start with fresh HTML.
Catalog public data keys include revision, locale where applicable, entity kind,
ID or canonical filters, and payload shape. Invalid/null detail results are not
retained; data-cache failures fall through to the origin.

## Contributor notes

- Keep public data and viewer projections separate in feature services.
- Never add a new page to cache admission before its personal overlay works.
- Public mutable content needs a write-triggered invalidation path; time-derived
  content needs an explicit time boundary rather than only a static revision.
- Client navigation warms route code on hover; data preload waits for tap/click
  (`src/app.html`, `src/lib/components/AGENTS.md`).
- Regression tests must cover auth/no-auth responses, mutation and subsequent
  reads, failed purge retries, and a fresh request after revision changes.
