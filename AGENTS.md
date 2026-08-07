# Life@USTC Server — Architecture Map

Read this instead of grepping the whole tree. Nested `AGENTS.md` files deepen
one area. Product capability names live in `docs/interface-hierarchy.md` and
`docs/contracts/`. How to **implement** a new capability is
`$life-ustc-feature`. Commit / PR / CI / merge follows **global** agent skills,
not this repo.

## System shape

```text
Clients:  Web · CLI · Bot · iOS · MCP agents
    │
    ▼
SvelteKit Worker (Cloudflare) + Node tools (migrate, static loader, CLI scripts)
    │
    ├── REST      /api/...
    ├── GraphQL   /api/graphql
    ├── MCP       /api/mcp
    ├── OAuth     /oauth, /api/auth, device flows
    └── Pages     /catalog/*, /workspace/*, /account/*, /admin/*, …
    │
    ▼
src/features/<domain>/server   ← domain use-cases (shared by all surfaces)
    │
    ▼
Prisma (PostgreSQL) · R2 uploads · Better Auth
```

Upstream campus snapshots come from the **static** repo; this repo’s Docker
**static loader** imports them. Production app deploy is Cloudflare Git
integration (`wrangler.jsonc`); see `docs/operations.md`.

## Directory map

```text
src/routes/              SvelteKit pages + thin HTTP handlers
src/features/            Domain use-cases + feature-owned UI
  <domain>/server/       Shared application logic (REST/GQL/MCP/pages call here)
  <domain>/components/   Feature UI (not in src/lib/components)
  dashboard/             Signed-in workspace UI (routes: /workspace/*)
src/lib/                 Infrastructure only
  ports/ · adapters/     Runtime contracts vs node/bun/fs implementations
  api/routes/            REST adapter helpers (may call features)
  graphql/               Yoga schema + resolvers
  mcp/tools/             MCP tools by domain (workspace, catalog, community, …)
  components/            Shared, feature-neutral UI
  auth/ · db/ · oauth/ · storage/ · time/ · …
messages/                i18n: zh-cn (default), en-us — no locale URL prefix
prisma/                  schema.prisma + migrations + seed.sql
docs/contracts/          Modular product/API/GraphQL/MCP JSON contracts
docs/graphql/            SDL snapshot + mutation capability matrix
tests/
  unit/                  Pure / mocked (no real DB)
  integration/           MCP harness + REST Playwright (playwright.api.config.ts)
  e2e/                   Browser Playwright against Worker (paths may still say dashboard/)
.agents/skills/          Project skills: feature implementation only
.github/workflows/       CI phases in db-backed-bun-job.yml (ci:verify, ci:integration, …)
```

**Do not edit:** `src/generated/prisma/`, `src/generated/prisma-node/`,
`public/openapi.generated.json`.

## Capability → code

| Concern | Where |
|---------|--------|
| Product / API contract | `docs/contracts/<module>.json` (+ `_meta` / `_product` / …) |
| Cross-surface naming | `docs/interface-hierarchy.md` |
| Use-case | `src/features/<domain>/server/` |
| Web page | `src/routes/...` + often `src/features/<domain>/components/` |
| REST | `src/routes/api/**/+server.ts` → `src/lib/api/routes/` → feature server |
| GraphQL | `src/lib/graphql/` (roots: `catalog`, `workspace`, `community`, `account`) |
| MCP tool | `src/lib/mcp/tools/<domain>/` — tool name = capability id |
| Copy | `messages/zh-cn.json`, `messages/en-us.json` |
| Schema | `prisma/schema.prisma` + migration |
| Unit tests | `tests/unit/` (never under `src/`) |
| MCP / REST integration | `tests/integration/mcp/`, `tests/integration/rest/` |
| Browser E2E | `tests/e2e/src/app/` |

Canonical seed: `tests/e2e/fixtures/scenario.json` → `prisma/seed.sql` →
`tests/fixtures/dev-seed.ts` (`DEV_SEED_ANCHOR`).

## Naming drift (intentional)

| Concept | Canonical product name | Code location today |
|---------|------------------------|---------------------|
| Signed-in home | `workspace` | Feature folder `dashboard/`, routes `/workspace/[tab]` |
| Overview REST helper | workspace overview | File still `me-overview-route.ts` |
| GraphQL personal data | `workspace.*` / `account.*` | Some modules still named `viewer.ts` |
| MCP tools | `workspace_*` capability ids | Files may say `my-data-*` / `dashboard-tools` |

Do not introduce a second `workspace` feature folder or a root GraphQL `viewer`.

## Web surface sketch

- Public catalog: `/catalog/courses|sections|teachers|bus|links`, `/search`
- Workspace tabs: `/workspace/{overview,calendar,homeworks,todos,exams,subscriptions}`
- Account: `/account/sign-in`, settings under `/account/...`
- Admin: `/admin/...`
- Some capabilities (e.g. schedules list, uploads) are API/MCP/CLI-first — no dedicated tab

Public SSR cache rules: `docs/rendering-and-cache.md` (canonical catalog detail
**root** paths only).

## Auth by surface

| Surface | Auth |
|---------|------|
| Pages | `event.locals.authUser`; else `buildSignInPageUrl` → `/account/sign-in?callbackUrl=…` |
| REST | `resolveApiUserId()` — Bearer or cookie |
| GraphQL | Bearer-first; audience `/api/graphql`; cookies need trusted Origin |
| MCP | Bearer only; audience `/api/mcp`; `getUserId(authInfo)` |

Suspended users cannot collaborative-write. Upload downloads use the shared
permission gate.

## Cross-cutting conventions

- Dates: `parseDateInput`; `@db.Date` filters → Asia/Shanghai day; `getShanghaiDay()`
- Prisma: `import { prisma, getPrisma } from "@/lib/db/prisma"`; localized reads via `getPrisma(locale)`
- REST errors: `handleRouteError` + status helpers; MCP: Zod in, unexpected errors throw
- Pagination: `buildPaginatedResponse`
- Native IO (`node:*` / `bun:*` / `fs` / …): adapters, approved infra (`auth`/`db`/`log`/`cloudflare`), or entrypoints (`static-loader`, `*-cli.ts`) — not ordinary features/routes

## Scoped maps

| Area | File |
|------|------|
| Docs index | `docs/index.md` |
| Contracts workflow shape | `docs/contracts/AGENTS.md` |
| Features / lib / GraphQL / MCP / components | `src/**/AGENTS.md` |
| Prisma | `prisma/AGENTS.md` |
| Tests | `tests/**/AGENTS.md` |
| CI workflows | `.github/workflows/AGENTS.md` |
| Ops (prod DB, Workers Builds) | `docs/operations.md` |

## Feature work

Use project skill `$life-ustc-feature` for module placement, surface parity, and
required tests when adding or changing a capability. Do not put commit/PR/CI
loops in project skills.
