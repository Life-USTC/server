# Web rendering and cache

Public, viewer-independent pages can be served from an anonymous HTML cache.
Signed-in, account, admin, and OAuth pages always use dynamic SSR with the
current viewer.

## Cacheable (anonymous only)

- Course / section / teacher list pages
- Catalog detail **root** paths (`/catalog/{courses|sections|teachers}/:id`)
- Bus map, mobile app, privacy, terms, Markdown guide, API docs

Any recognized session or Bearer signal forces dynamic SSR. Pages that still
embed viewer-specific data (home, links planner, community) stay dynamic.

In-page catalog sections use hash anchors on the detail root; legacy path tabs
are not cache admission paths.

## Contributor notes

- Hydration still uses Better Auth's normal session endpoint after anonymous HTML.
- Don't put user-specific data into a payload you intend to cache anonymously.
- Client navigation may warm route code on hover; data preload waits for
  tap/click (`docs` / `src/app.html` preload attributes — see
  `src/lib/components/AGENTS.md`).

Worker and Cache API implementation details live in code
(`src/worker.js`, `src/lib/cloudflare/`), not in this doc.
