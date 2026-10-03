# Life@USTC Server

Start here instead of grepping the whole tree. Nested `AGENTS.md` files go
deeper on one area (closest file wins). Shared names live in
`docs/policies/interface-hierarchy.yaml` and `docs/features/`. To add or change behavior,
use the workspace-level `$life-ustc-implement` skill in
`Life-USTC/.agents/skills/`; this repository owns server-specific guidance.

## Architecture

Web, REST, GraphQL, and MCP call shared `src/features/<domain>/server` use-cases.
The app runs on a SvelteKit Cloudflare Worker with Prisma/PostgreSQL, R2, and
Better Auth. Node entrypoints handle migrations and the static loader, which
imports upstream snapshots from the **static** repo. Production deploys through
Cloudflare Git; secrets and bindings live in the Cloudflare Dashboard.

## Where code lives

```text
src/routes/              SvelteKit pages + thin HTTP handlers
src/features/            Domain use-cases + feature-owned UI
  <domain>/server/       Shared application logic
  <domain>/components/   Feature UI (not in src/lib/components)
  workspace/             Signed-in workspace UI (routes: /workspace/*)
src/lib/                 Infrastructure only
  ports/                 Env + Cloudflare runtime contracts (`env.ts`, `runtime.ts`)
  adapters/              Cloudflare runtime wiring (features import via ports/)
  api/routes/            REST adapters (may call features; keep route files thin)
  graphql/ · mcp/tools/  Yoga schema; MCP tools by domain
  components/            Shared, feature-neutral UI
  auth/ · db/ · oauth/ · storage/ · time/ · …
messages/                i18n: zh-cn (default), en-us — no locale URL prefix
prisma/                  schema.prisma + migrations + seed.sql
docs/features/           Feature specifications (YAML)
docs/policies/           Cross-feature product and architecture requirements
docs/schemas/            Strict JSON Schemas for specification data
docs/graphql/            Generated SDL snapshot
docs/reference/          Structured interface reference data
tests/unit|integration|e2e
.github/workflows/       CI phases in bun-job.yml / db-backed-bun-job.yml
```

**Do not edit:** `src/generated/prisma/`, `src/generated/prisma-node/`,
`public/openapi.generated.json`.

## Local checks

Needs Bun (`.bun-version`), Docker Compose, and host `psql`. Locally you can use
one `DATABASE_URL` for development. Database-backed tests require a disposable
database and separate app/auth/maintenance roles, prepared below. First
Playwright run: `bunx playwright install --with-deps chromium`.

```bash
# Dev
bun install --frozen-lockfile && bun run hooks:install
cp .env.example .env   # once
docker compose -f docker-compose.dev.yml up -d
bun run app:prepare && bun run db:migrate:deploy
ALLOW_DATABASE_SEED=true bunx prisma db seed
bun run dev            # http://127.0.0.1:3000

# Local static, unit, type, specification, and schema checks
bun run check

# Integration (same shape as CI ci:integration), in Bash
export FUNCTION_OWNER_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/life_ustc_test"
export ALLOW_TEST_DATABASE_SETUP=true
source tests/ci/setup-runtime-database.sh
bunx vitest run --config vitest.integration.config.ts
bun run build && bun run rest:test

# Parallel integration: provisions and cleans up four isolated databases
bun run integration:test:parallel

# E2E — each case owns its database and Worker
# Use the disposable FUNCTION_OWNER_DATABASE_URL and setup flags above.
source tests/ci/setup-runtime-database.sh
bun run build
bun run e2e:test
# Native Playwright filters/options also work, e.g. bun run e2e:test --project=chromium

docker compose -f docker-compose.dev.yml down
```

CI phases live in `.github/workflows/bun-job.yml` (static, unit, build) and
`.github/workflows/db-backed-bun-job.yml` (database-backed tests). Uploads in
E2E/Worker flows use Wrangler local `R2_UPLOADS` — don't add MinIO unless you're
specifically testing object storage.

## Delivery gate

Before opening a PR, run local checks and the complete CI workflow on the
pushed branch with `gh workflow run ci.yml --ref <branch>`. Verify the run's
head SHA and every mandatory job: static checks, unit coverage, build/client
budget, static-loader image, RLS, all integration/REST/E2E shards, and the aggregate required-jobs gate.
The protected check named Specification execution evidence now validates native
job outcomes and document structure; it does not infer requirement coverage. `bun run check` alone is insufficient.
Visual changes also require the visual suite and matched before/after evidence.

After review changes, revalidate the current head. Merge only when main's
required checks pass and review conversations are resolved; never bypass
protection. Releases publish tags and GitHub release notes without committing
back to main.

MCP tool names match each capability's `mcp.tools[].name`, not its contract ID.
Fixtures: `tests/e2e/fixtures/scenario.json` feeds `tests/fixtures/dev-seed.ts`
(`DEV_SEED_ANCHOR`). Keep `prisma/seed.sql` aligned with that scenario.

## Web and auth

Read `docs/policies/interface-hierarchy.yaml` for route scope and surface rules,
and `docs/policies/rendering-and-cache.yaml` for public/private rendering.

| Entry | Auth |
|-------|------|
| Pages | `event.locals.authUser`, else `buildSignInPageUrl` → `/account/sign-in?callbackUrl=…` |
| REST | Protected routes declare `bearerScope`; optional personalization uses `resolveSessionUserId()` (cookie only) |
| GraphQL | Bearer-first; audience `/api/graphql`; cookies need trusted Origin |
| MCP | Bearer only; audience `/api/mcp`; `getUserId(authInfo)` |

Read the comment/upload feature specifications and cases.content-security policy
for suspension and download authorization requirements; enforce them through the shared permission gates.

Never use an ambient OAuth identity for optional personalization. Use
`requireAuth` / `resolveApiPrincipal` with an explicit feature/action scope for
Bearer-capable routes, and `resolveSessionUserId` for session-only reads.

## Conventions

- Dates: `parseDateInput`; `@db.Date` → Asia/Shanghai day; `startOfShanghaiDay` /
  `shanghaiDayjs`
- Prisma: `import { prisma, getPrisma } from "@/lib/db/prisma"`
- REST errors: `handleRouteError`; MCP: Zod inputs, let unexpected errors throw
- Pagination: `buildPaginatedResponse` from `@/lib/pagination` (features) or
  `@/lib/api/helpers` (REST)
- Native IO (`node:*` / `bun:*` / `fs` / …): approved infra (`auth` / `db` /
  `log` / `cloudflare`), Cloudflare `adapters/`, or entrypoints (`static-loader`,
  `*-cli.ts`) — not ordinary features or routes. Features use `@/lib/ports/`
  for env and Cloudflare runtime accessors.

## Boundaries

**Always**

- Put domain logic in `src/features/*/server`; keep routes / MCP / GraphQL thin.
- When behavior changes, update the matching contracts and REST/GraphQL/MCP/Web
  (`$life-ustc-implement`).
- Complete the delivery gate before opening and merging a PR.
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

Read `docs/AGENTS.md` for contracts, `prisma/AGENTS.md` for schema work,
`src/**/AGENTS.md` for implementation, `tests/**/AGENTS.md` for harnesses, and
`.github/workflows/AGENTS.md` for CI. `docs/index.md` indexes specifications.
