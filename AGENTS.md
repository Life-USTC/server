# Life@USTC Server

Start here instead of grepping the whole tree. Nested `AGENTS.md` files go
deeper on one area (closest file wins). Shared names live in
`docs/interface-hierarchy.md` and `docs/contracts/`. To add or change behavior,
use `$life-ustc-implement`.

## How the system fits together

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
src/features/<domain>/server   ← shared use-cases (REST/GraphQL/MCP/Web call here)
    │
    ▼
Prisma (PostgreSQL) · R2 uploads · Better Auth
```

Upstream data comes from the **static** repo; the Docker **static loader** here
imports it. Production app deploys via Cloudflare Git (`wrangler.jsonc`).
Secrets and environment bindings live in the Cloudflare Dashboard — not in docs.

## Where code lives

```text
src/routes/              SvelteKit pages + thin HTTP handlers
src/features/            Domain use-cases + feature-owned UI
  <domain>/server/       Shared application logic
  <domain>/components/   Feature UI (not in src/lib/components)
  dashboard/             Signed-in workspace UI (routes: /workspace/*)
src/lib/                 Infrastructure only
  ports/                 Env contracts (`env.ts`)
  adapters/              Cloudflare runtime wiring
  api/routes/            REST adapters (may call features; keep route files thin)
  graphql/ · mcp/tools/  Yoga schema; MCP tools by domain
  components/            Shared, feature-neutral UI
  auth/ · db/ · oauth/ · storage/ · time/ · …
messages/                i18n: zh-cn (default), en-us — no locale URL prefix
prisma/                  schema.prisma + migrations + seed.sql
docs/contracts/          Product / API / GraphQL / MCP JSON contracts
docs/graphql/            SDL snapshot + mutation matrix
tests/unit|integration|e2e
.agents/skills/          Project skills (how to implement changes)
.github/workflows/       CI phases in db-backed-bun-job.yml
```

**Do not edit:** `src/generated/prisma/`, `src/generated/prisma-node/`,
`public/openapi.generated.json`.

## Local checks

Needs Bun (`.bun-version`), Docker Compose, and host `psql`. Locally you can use
one `DATABASE_URL` (production uses separate app/auth database bindings). First
Playwright run: `bunx playwright install --with-deps chromium`.

```bash
# Dev
bun install --frozen-lockfile && bun run hooks:install
cp .env.example .env   # once
docker compose -f docker-compose.dev.yml up -d
bun run app:prepare && bun run db:migrate:deploy && bunx prisma db seed
bun run dev            # http://127.0.0.1:3000

# Default checks (what you usually run before handoff)
bun run app:prepare
bunx wrangler types --include-runtime=false --check
bunx biome check
bunx svelte-check --tsconfig ./tsconfig.json
bunx tsc --noEmit -p tsconfig.typecheck.json
bunx tsc --noEmit -p tsconfig.typecheck.tests.json
bunx tsc --noEmit -p tsconfig.typecheck.operational.json
bunx vitest run
bun run openapi:check
bunx vitest run tests/unit/graphql-schema-snapshot.test.ts

# CI ci:verify also runs these shell guards — run if you touch them or CI fails there
# bash tests/ci/retry.test.sh
# bash tests/ci/seed-guard.test.sh
# bash tests/ci/e2e-full-suite-parity.test.sh

# Integration (same shape as CI ci:integration)
bun run db:migrate:deploy && bunx prisma db seed
bunx vitest run --config vitest.integration.config.ts
bun run build && bun run rest:test

# E2E — script prepares, builds, migrates, and reseeds per shard
ALLOW_DATABASE_SEED=true bun run e2e:test

docker compose -f docker-compose.dev.yml down
```

CI phase scripts live in `.github/workflows/db-backed-bun-job.yml`. Uploads in
E2E/Worker flows use Wrangler local `R2_UPLOADS` — don't add MinIO unless you're
specifically testing object storage.

## Where things live

| Concern | Where |
|---------|--------|
| Product / API contract | `docs/contracts/<module>.json` |
| Shared naming | `docs/interface-hierarchy.md` |
| Use-case | `src/features/<domain>/server/` |
| Web | `src/routes/...` + `src/features/<domain>/components/` |
| REST | `src/routes/api/**/+server.ts` → `src/lib/api/routes/` → feature |
| GraphQL | `src/lib/graphql/` (`catalog` / `workspace` / `community` / `account`) |
| MCP | `src/lib/mcp/tools/<domain>/` — tool name matches the contract id |
| Copy | `messages/zh-cn.json`, `messages/en-us.json` |
| Schema | `prisma/schema.prisma` + migration |
| Unit / integration / E2E | `tests/unit/`, `tests/integration/`, `tests/e2e/` |

Fixtures: `tests/e2e/fixtures/scenario.json` feeds `tests/fixtures/dev-seed.ts`
(`DEV_SEED_ANCHOR`). `prisma/seed.sql` is the executable DB seed (kept in sync
with that scenario; not auto-generated in-repo).

## Old names still in the tree

| Idea | Product name | Code today |
|------|--------------|------------|
| Signed-in home | `workspace` | Feature folder `dashboard/`, routes `/workspace/[tab]` |
| Overview REST | workspace overview | File `me-overview-route.ts` |
| GraphQL personal data | `workspace.*` / `account.*` | Some files still `viewer.ts` |
| MCP tools | `workspace_*` ids | Files may say `my-data-*` / `dashboard-*` |

Don't add a second `workspace` feature folder or a root GraphQL `viewer`.

## Web and auth

- Catalog: `/catalog/courses|sections|teachers|bus|links`, `/search`
- Workspace tabs: `/workspace/{overview,calendar,homeworks,todos,exams,subscriptions}`
- Account: `/account/sign-in` (+ settings); Admin: `/admin/...`
- Schedules list and uploads are mostly API / MCP / CLI — not always a Web tab
- Public HTML cache rules: `docs/rendering-and-cache.md` (lists, detail roots,
  bus map, legal pages, and a few others — not only catalog detail)

| Entry | Auth |
|-------|------|
| Pages | `event.locals.authUser`, else `buildSignInPageUrl` → `/account/sign-in?callbackUrl=…` |
| REST | Protected routes declare `bearerScope`; optional personalization uses `resolveSessionUserId()` (cookie only) |
| GraphQL | Bearer-first; audience `/api/graphql`; cookies need trusted Origin |
| MCP | Bearer only; audience `/api/mcp`; `getUserId(authInfo)` |

Suspended users can't collaborative-write. Upload downloads use the shared
permission gate.

Never use an ambient OAuth identity for optional personalization. Use
`requireAuth` / `resolveApiPrincipal` with an explicit feature/action scope for
Bearer-capable routes, and `resolveSessionUserId` for session-only reads.

## Conventions

- Dates: `parseDateInput`; `@db.Date` → Asia/Shanghai day; `startOfShanghaiDay` /
  `shanghaiDayjs`
- Prisma: `import { prisma, getPrisma } from "@/lib/db/prisma"`
- REST errors: `handleRouteError`; MCP: Zod inputs, let unexpected errors throw
- Pagination: `buildPaginatedResponse`
- Native IO (`node:*` / `bun:*` / `fs` / …): approved infra (`auth` / `db` /
  `log` / `cloudflare`), Cloudflare `adapters/`, or entrypoints (`static-loader`,
  `*-cli.ts`) — not ordinary features or routes

## Boundaries

**Always**

- Put domain logic in `src/features/*/server`; keep routes / MCP / GraphQL thin.
- When behavior changes, update the matching contracts and REST/GraphQL/MCP/Web
  (`$life-ustc-implement`).
- Run the local checks that cover what you touched.
- Keep secrets, tokens, cookies, and upload URLs out of logs and commits.

**Ask first**

- Broad doc rewrites or new parallel instruction files (`CLAUDE.md`, etc.).
- Exposing admin/governance through GraphQL, MCP, or Bot.
- Adding MinIO/S3 emulation, app-serving Docker, or repo-managed production deploys.

**Never**

- Hand-edit generated Prisma or OpenAPI output.
- Put business rules in `src/lib/api`, `src/lib/graphql`, or `src/lib/mcp`.
- Change shared seed rows from parallel tests.
- Leave scratch plans, probes, or Playwright output in the tree.
- Publish production monitoring, log/metrics query playbooks, deploy runbooks,
  unfinished security roadmaps, or internal host/path defaults in this repo.
- Force-push or rewrite history unless the user explicitly asks.

## Deeper guides

| Area | File |
|------|------|
| Doc index | `docs/index.md` |
| Contracts | `docs/contracts/AGENTS.md` |
| Features / lib / GraphQL / MCP / components | `src/**/AGENTS.md` |
| Prisma | `prisma/AGENTS.md` |
| Tests | `tests/**/AGENTS.md` |
| CI workflows | `.github/workflows/AGENTS.md` |
| Public SSR cache notes | `docs/rendering-and-cache.md` |
