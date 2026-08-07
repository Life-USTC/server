# Life@USTC Server — Architecture Map

Read this instead of grepping the whole tree. Nested `AGENTS.md` files deepen
one area (closest file wins). Capability names: `docs/interface-hierarchy.md` and
`docs/contracts/`. Implementing a capability: `$life-ustc-feature`. Commit / PR /
CI / merge: **global** agent skills — not this repo.

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
src/features/<domain>/server   ← domain use-cases (all surfaces call here)
    │
    ▼
Prisma (PostgreSQL) · R2 uploads · Better Auth
```

Upstream snapshots: **static** repo → Docker **static loader** here. Production
app: Cloudflare Git + `wrangler.jsonc` (`docs/operations.md`).

## Directory map

```text
src/routes/              SvelteKit pages + thin HTTP handlers
src/features/            Domain use-cases + feature-owned UI
  <domain>/server/       Shared application logic
  <domain>/components/   Feature UI (not in src/lib/components)
  dashboard/             Signed-in workspace UI (routes: /workspace/*)
src/lib/                 Infrastructure only
  ports/ · adapters/     Runtime contracts vs node/bun/fs implementations
  api/routes/            REST adapters (may call features; keep route files thin)
  graphql/ · mcp/tools/  Yoga schema; MCP tools by domain
  components/            Shared, feature-neutral UI
  auth/ · db/ · oauth/ · storage/ · time/ · …
messages/                i18n: zh-cn (default), en-us — no locale URL prefix
prisma/                  schema.prisma + migrations + seed.sql
docs/contracts/          Modular product/API/GraphQL/MCP JSON contracts
docs/graphql/            SDL snapshot + mutation capability matrix
tests/unit|integration|e2e
.agents/skills/          Project skills (feature implementation only)
.github/workflows/       CI phases in db-backed-bun-job.yml
```

**Do not edit:** `src/generated/prisma/`, `src/generated/prisma-node/`,
`public/openapi.generated.json`.

## Commands

Needs Bun (`.bun-version`), Docker Compose, and host `psql`. Local auth may use a
single `DATABASE_URL` (see `docs/operations.md` for production split). First
browser/API Playwright: `bunx playwright install --with-deps chromium`.

```bash
# Dev
bun install --frozen-lockfile && bun run hooks:install
cp .env.example .env   # once
docker compose -f docker-compose.dev.yml up -d
bun run app:prepare && bun run db:migrate:deploy && bunx prisma db seed
bun run dev            # http://127.0.0.1:3000

# Default checks (most of CI ci:verify)
bun run app:prepare
bunx wrangler types --include-runtime=false --check
bunx biome check
bunx svelte-check --tsconfig ./tsconfig.json
bunx tsc --noEmit -p tsconfig.typecheck.json
bunx tsc --noEmit -p tsconfig.typecheck.tests.json
bunx tsc --noEmit -p tsconfig.typecheck.operational.json
bunx vitest run

# When REST OpenAPI / JSDoc changed
bun run openapi:check

# When GraphQL schema / contracts changed
bunx vitest run tests/unit/graphql-schema-snapshot.test.ts

# Integration (aligns with CI ci:integration)
bun run db:migrate:deploy && bunx prisma db seed
bunx vitest run --config vitest.integration.config.ts
bun run build && bun run rest:test

# E2E (CI parity suite — not a bare playwright test)
bun run db:migrate:deploy && bunx prisma db seed
bun run app:prepare && bun run build && bun run e2e:test

docker compose -f docker-compose.dev.yml down
```

CI phase scripts are the source of truth in
`.github/workflows/db-backed-bun-job.yml`. Upload/E2E storage uses Wrangler local
`R2_UPLOADS` — do not add MinIO unless testing object storage itself.

## Capability → code

| Concern | Where |
|---------|--------|
| Product / API contract | `docs/contracts/<module>.json` |
| Cross-surface naming | `docs/interface-hierarchy.md` |
| Use-case | `src/features/<domain>/server/` |
| Web | `src/routes/...` + `src/features/<domain>/components/` |
| REST | `src/routes/api/**/+server.ts` → `src/lib/api/routes/` → feature |
| GraphQL | `src/lib/graphql/` (`catalog` / `workspace` / `community` / `account`) |
| MCP | `src/lib/mcp/tools/<domain>/` — tool name = capability id |
| Copy | `messages/zh-cn.json`, `messages/en-us.json` |
| Schema | `prisma/schema.prisma` + migration |
| Unit / integration / E2E | `tests/unit/`, `tests/integration/`, `tests/e2e/` |

Seed: `tests/e2e/fixtures/scenario.json` → `prisma/seed.sql` →
`tests/fixtures/dev-seed.ts` (`DEV_SEED_ANCHOR`).

## Naming drift (intentional)

| Concept | Product name | Code today |
|---------|--------------|------------|
| Signed-in home | `workspace` | Feature `dashboard/`, routes `/workspace/[tab]` |
| Overview REST | workspace overview | File `me-overview-route.ts` |
| GraphQL personal | `workspace.*` / `account.*` | Some files still `viewer.ts` |
| MCP tools | `workspace_*` ids | Files may say `my-data-*` / `dashboard-*` |

Do not add a parallel `workspace` feature folder or a root GraphQL `viewer`.

## Web / auth sketch

- Catalog: `/catalog/courses|sections|teachers|bus|links`, `/search`
- Workspace tabs: `/workspace/{overview,calendar,homeworks,todos,exams,subscriptions}`
- Account: `/account/sign-in` (+ settings); Admin: `/admin/...`
- Some capabilities (schedules list, uploads) are API/MCP/CLI-first
- SSR cache: `docs/rendering-and-cache.md` (canonical catalog detail **roots** only)

| Surface | Auth |
|---------|------|
| Pages | `event.locals.authUser` → else `buildSignInPageUrl` → `/account/sign-in?callbackUrl=…` |
| REST | `resolveApiUserId()` (Bearer or cookie) |
| GraphQL | Bearer-first; audience `/api/graphql`; cookies need trusted Origin |
| MCP | Bearer only; audience `/api/mcp`; `getUserId(authInfo)` |

Suspended users: no collaborative writes. Uploads: shared download permission gate.

## Conventions

- Dates: `parseDateInput`; `@db.Date` → Asia/Shanghai day; `getShanghaiDay()`
- Prisma: `import { prisma, getPrisma } from "@/lib/db/prisma"`
- REST errors: `handleRouteError`; MCP: Zod in, unexpected errors throw
- Pagination: `buildPaginatedResponse`
- Native IO: adapters, approved infra (`auth`/`db`/`log`/`cloudflare`), or
  entrypoints (`static-loader`, `*-cli.ts`) — not ordinary features/routes

## Boundaries

**Always**

- Put domain logic in `src/features/*/server`; keep routes/MCP/GraphQL thin.
- Update matching contracts and surfaces when behavior changes (`$life-ustc-feature`).
- Run the Commands that cover what you touched before handoff.
- Keep secrets, tokens, cookies, and upload URLs out of logs and commits.

**Ask first**

- Broad documentation rewrites or new parallel instruction files (`CLAUDE.md`, etc.).
- Exposing admin/governance through GraphQL, MCP, or Bot.
- Adding MinIO/S3 emulation, app-serving Docker, or repo-managed production deploys.

**Never**

- Edit generated Prisma/OpenAPI outputs by hand.
- Put business rules in `src/lib/api`, `src/lib/graphql`, or `src/lib/mcp`.
- Mutate canonical seed rows in parallel tests.
- Leave scratch plans, probes, or Playwright output in the tree.
- Force-push or rewrite history unless the user explicitly asks.

## Scoped maps

| Area | File |
|------|------|
| Docs index | `docs/index.md` |
| Contracts | `docs/contracts/AGENTS.md` |
| Features / lib / GraphQL / MCP / components | `src/**/AGENTS.md` |
| Prisma | `prisma/AGENTS.md` |
| Tests | `tests/**/AGENTS.md` |
| CI workflows | `.github/workflows/AGENTS.md` |
| Ops | `docs/operations.md` |

## Feature work

Use `$life-ustc-feature` for module placement, surface parity, and required tests.
Do not put commit/PR/CI loops in project skills.
