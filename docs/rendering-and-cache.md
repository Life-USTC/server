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

## Contributor notes

- Don't put user-specific data into a payload you intend to cache anonymously.
- Keep `/_internal` in the dynamic/private gateway roots even though the shell
  fetches JSON rather than HTML.
- Client navigation may warm route code on hover; data preload waits for
  tap/click (`docs` / `src/app.html` preload attributes — see
  `src/lib/components/AGENTS.md`).

Worker and Cache API implementation details live in code
(`src/worker.js`, `src/lib/cloudflare/`), not in this doc.
