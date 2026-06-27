# Life@USTC Server - Agent Guide

SvelteKit campus workspace with REST + MCP APIs. This is the canonical coding-agent instruction file; nested `AGENTS.md` files only add scoped rules.

## Repo Map

```text
src/routes/           SvelteKit pages, layouts, REST handlers, OAuth/MCP routes
src/features/         Domain logic and feature-owned components
src/lib/              Infrastructure: ports/adapters, helpers, and shared UI in `src/lib/components`
src/lib/ports/        Abstract runtime contracts imported by domain code
src/lib/adapters/     Concrete runtime implementations (node:*, bun:*, fs, process, etc.)
messages/             i18n strings (`zh-cn`, `en-us`)
prisma/               Prisma schema and migrations
docs/contracts/        Product/API/MCP contracts checked against schema/API/MCP parity
tests/                Unit, integration MCP harness, and Playwright E2E tests
.agents/skills/       Repo-scoped reusable agent workflows
.github/workflows/    CI/CD workflows
```

## Tool Stages

Use `$life-ustc-dev-loop` for the canonical setup/check/test/handoff sequence. The only package-level shortcuts are:

```bash
bun install --frozen-lockfile
bun run dev             # app dev; start local Docker infra first when DB/storage is needed
bun run build           # production build
bun run app:prepare     # generate Prisma client and sync SvelteKit
bun run db:migrate:deploy # run migrations
```

Local Postgres runs through Docker Compose directly:
`docker compose -f docker-compose.dev.yml up -d` to start and
`docker compose -f docker-compose.dev.yml down` to stop. Upload storage is the
Cloudflare `R2_UPLOADS` binding and needs Wrangler-backed flows when exercised
locally. Production deploys through Cloudflare Git integration. The only durable
Docker runtime is the static loader.

## Agent Operating Contract

- Treat this file as the compact project contract. Before touching a scoped area, also read the nearest `AGENTS.md`; closer files override broader guidance.
- Keep durable rules here short and actionable. Move repeated, specialized workflows into `.agents/skills` or the closest scoped `AGENTS.md` instead of bloating root guidance.
- Keep `AGENTS.md` as the canonical agent instruction surface. Do not add parallel files such as `copilot-instructions.md`, `CLAUDE.md`, or `GEMINI.md` unless the user explicitly asks for a compatibility shim.
- Keep reusable repo skills in `.agents/skills` so they follow the open Agent Skills discovery path. Do not add `.codex/skills` unless the user explicitly asks for a Codex-private experiment.
- Use checked-in skills for repeatable workflows: `$life-ustc-dev-loop` for the development loop and `$life-ustc-pr-workflow` for PR/check loops.
- For non-trivial feature or fix work, split the job into at least two fresh passes when tooling allows: one checks/updates contracts and docs, the other implements against current source. Integrate, verify, and repeat until behavior and contracts match.
- Work in this loop: inspect code/docs first, plan the smallest safe edit, implement, run the relevant gate, inspect the diff, and verify the final behavior against the user request.
- Done means evidence-backed: cite the files changed, commands run, and any skipped checks with the reason. Passing tests alone is not enough if they do not cover the requested behavior.
- Do not infer contracts from old docs, generated files, or optimistic commit messages. Check the source of truth: route handlers, Prisma schema/migrations, contract JSON, tests, and current package scripts.
- Think forward: prefer clean, simple, durable code over monkeypatches, brittle one-off shortcuts, or fixes that knowingly leave avoidable tech debt.
- Inspect `git diff` before the final answer. Call out unverified commands, risky changes, and any docs updates intentionally skipped.
- Do not rewrite git history, remove attribution, or force-push unless the user explicitly asks for that operation in the current task.
- Update the nearest `AGENTS.md` when repeated agent mistakes reveal missing durable guidance; keep the change concise and operational.

## Architecture Boundaries

- Keep `src/routes` thin: routing, pages, handlers, metadata. Put domain logic in `src/features`.
- Keep `src/lib` for infrastructure helpers and cross-cutting utilities, not feature rules.
- Keep shared `src/lib/components` free of feature-specific data fetching and mutations.
- Do not call SvelteKit page handlers or REST route handlers from features or page actions. Extract shared work into `src/features/*/server` and let routes adapt it to HTTP.
- Before exposing a feature through multiple surfaces, put shared gates, common operations, and update/read services in `src/features/<feature>/server`; surface code should only handle transport-specific auth, validation, redirects, serialization, or output shaping.
- REST, MCP, contract JSON, OpenAPI annotations, and tests are coupled surfaces; check all matching surfaces when one changes.
- Treat `prisma/schema.prisma`, migrations, route handlers, contract JSON, and tests as source of truth over stale docs or generated output.

## Complete-Loop Checks

- UI/layout changes: run the narrowest browser check that exercises the changed screen, inspect a screenshot/headed run/trace for the affected area, and iterate on visible regressions before handoff.
- REST/MCP behavior changes: decide whether both surfaces should change. If only one changes, document why; then exercise at least one representative public request or MCP tool call when feasible, inspect the serialized success/error output, and compare it with contracts/tests.
- Keep screenshots, traces, temporary payloads, and ad hoc probes out of the repo unless they are intentional fixtures.

## Shared Test Seed

- Canonical seeded fixture data lives in `tests/e2e/fixtures/scenario.json`; `prisma/seed.sql` materializes it and `tests/fixtures/dev-seed.ts` exports the named constants used by tests.
- The shared anchor comes from `DEV_SEED_ANCHOR` in `tests/fixtures/dev-seed.ts`. Use `.date` for bare date filters, `.recommendedAtTime` for time-sensitive tool calls, and `.startOfDayAtTime` when a test needs the seed day boundary.
- `$life-ustc-dev-loop` already seeds the shared scenario data; if you invoke integration specs directly, run `bunx prisma db seed` first.
- Scoped `tests/**/AGENTS.md` files should only add layer-specific caveats and link shared commands/setup back here or to helper files such as `tests/integration/utils/mcp-harness.ts`.

## Local Dev Environment

- `.env` is configured for host-native dev (`bun run dev`) against local Postgres on `127.0.0.1`.
- Upload storage is provided by the Cloudflare `R2_UPLOADS` binding; use `wrangler dev` based flows when exercising upload storage locally.
- Install local browser runtime once before browser/E2E checks: `bunx playwright install chromium`. Use `bunx playwright install --with-deps chromium` on Linux if system libraries are missing.
- `bun run dev` starts Vite directly; run `bun run app:prepare` and `bun run db:migrate:deploy` (or follow `$life-ustc-dev-loop`) before the first start. It no longer auto-runs OpenAPI generation or migrations.
- Host-native `bun run dev` is pinned to `127.0.0.1:3000`.
- Prefer these flows for pain-free setup:
  1. `docker compose -f docker-compose.dev.yml up -d && bun run dev` for host-native app dev

## Production Deployment

- The production app runs on Cloudflare Workers via Cloudflare Git integration and `wrangler.jsonc`; do not reintroduce GitHub Actions deploy jobs, manual deploy scripts, Docker app, or compose runtime paths for frontend/backend serving.
- The only durable Docker image in this repo is the static data loader. It requires `DATABASE_URL`, runs migrations, then executes `docker-entrypoint.load.sh`.

## Documentation Structure

```
docs/index.md          Navigation map for repo docs
docs/contracts/          Product/API/MCP contracts (modular JSON)
  _meta.json           Product metadata
  _product.json        Roles, workflow
  _ui.json             UI patterns
  _cases.json          Cross-feature scenarios
  _audit.json          Audit actions
  user.json            Contract modules
  course.json          ...
  ...

src/*/AGENTS.md         Scoped implementation guides
.agents/skills/         Reusable repo workflows loaded on demand
```

## Common Patterns

### Auth
- **Pages**: `requireSignedInUserId()` → redirects to `/signin`
- **API**: `resolveApiUserId()` → accepts Bearer OR cookie
- **MCP**: Bearer only, audience `/api/mcp`; read user id with `getUserId(extra.authInfo)`
- Check permissions BEFORE mutations
- Suspended users blocked from collaborative writes

### Dates
- **Input**: `parseDateInput(str)` accepts YYYY-MM-DD or ISO
- **Output**: `jsonResponse(data)` serializes dates
- **Display**: `getShanghaiDay()` for boundaries

### Prisma
- **Import**: `import { prisma, getPrisma } from "@/lib/db/prisma"`
- **Writes**: `prisma.model.create()`
- **Localized reads**: `getPrisma(locale).model.findMany()`

### Errors
- **API**: `handleRouteError(err)`
- **Status**: `unauthorized()`, `forbidden()`, `notFound()`, `badRequest()`
- **MCP**: validate inputs with Zod; let unexpected errors throw so the SDK reports tool failure

### i18n
- Supported: `zh-cn` (default), `en-us`
- No locale prefix in URLs
- User text needs both message files
- **Import**: `import { Link } from "@/i18n/routing"`

### Validation
```typescript
const schema = z.object({ name: z.string().min(1) });
const data = schema.parse(input);
```

### Pagination
```typescript
buildPaginatedResponse(items, page, pageSize, total)
```

## File Rules

**Generated - DO NOT EDIT**:
- `src/generated/prisma/`
- `src/generated/prisma-node/`
- `public/openapi.generated.json`

**Feature Changes**:
1. Check the affected contract module before implementation.
2. Update `docs/contracts/<module>.json` only when behavior, API/MCP shape, permissions, or user-visible workflow changes.
3. Implement code and update tests where behavior is observed.
4. Run the check sequence in `$life-ustc-dev-loop`, escalating to the integration and E2E sequences when data flows, auth, browser flows, docs/contracts, or shared tooling change.

**Documentation Alignment**:
- Public REST API change → update route OpenAPI annotations, `docs/contracts/openapi.json` when relevant, then run `bun run build`.
- MCP tool/parameter/output change → update the matching `docs/contracts/<module>.json` and integration coverage.
- User-visible behavior change → update the affected contract JSON and user-facing docs if present.
- Architecture or dependency-boundary change → update `docs/index.md`, the nearest scoped `AGENTS.md`, or an ADR/runbook if one exists.
- Operational/setup/config change → update `README.md`, `docs/index.md`, workflow docs, or `.env.example` as applicable.
- If no docs update is needed, state why in the final summary.

**Security & Privacy**:
- Never log tokens, secrets, session cookies, OAuth codes, upload URLs, or personal data beyond what a test explicitly requires.
- Preserve auth surface differences: pages redirect, REST returns status responses, MCP is bearer-only with `/api/mcp` audience.
- Check permissions before mutations; suspended users are blocked from collaborative writes.
- Upload downloads require a shared permission gate: owners may download their files, and signed-in viewers may download files attached to comments they are allowed to read.

**Documentation Changes**:
- Ask before broad documentation rewrites or restructures when the user did not explicitly request doc edits.
- When docs must change as part of code work, keep the edits narrow and run the same default gate.

**Default Verification**:
- Use `$life-ustc-dev-loop` for the canonical check sequence.
- Run the integration and E2E sequences from `$life-ustc-dev-loop` before pushing changes that affect data flows, auth, browser flows, docs contracts, or shared tooling.
- Repo-owned checks should keep success output concise and print actionable failures.

**No Stray Reports**:
- Do not leave migration plans, improvement reports, status summaries, scratch artifacts, or one-time analysis outputs in the repo.
- Temporary planning files, local verification scripts, ad hoc probes, and throwaway code are acceptable only if removed before finishing.
- Before handoff, inspect `git status --short` and ensure only intentional durable source, docs, config, or test changes remain.
- Use GitHub issues/PRs for durable tracking

**PR / Change Summary**:
- Summaries should name changed files, behavior/doc impact, commands run, skipped checks with reasons, and residual risks.
- Review the diff for unrelated rewrites, generated-file edits, missing docs/tests, and REST/MCP parity gaps before handing off.

## Scoped Guides

- **Contracts**: `docs/contracts/<module>.json` - Product/API/MCP specifications
- **Source**: `src/AGENTS.md` - Organization
- **Routes**: `src/routes/` - SvelteKit pages and REST handlers
- **MCP**: `src/lib/mcp/AGENTS.md` - MCP tools
- **Features**: `src/features/AGENTS.md` - Business logic
- **Components**: `src/lib/components/AGENTS.md` - UI
- **Prisma**: `prisma/AGENTS.md` - Schema
- **Tests**: `tests/{e2e,integration,unit}/AGENTS.md` (layer-specific notes only)
- **CI/CD**: `.github/workflows/AGENTS.md`

## Known Issues

**Better Auth social providers**: Profile types must match library exactly:
- `GithubProfile.email` is `string | null` not `string | undefined`
- Mismatches break typecheck and Docker build

## Agent Audit Guardrails

History shows agent-assisted changes in this repo most often went wrong when they trusted stale shape assumptions, fought CI/E2E bootstrap, crossed Worker/Node runtime boundaries, or created convenience artifacts that later had to be removed. Guard against these patterns:

- **Contracts**: Keep contract JSON hand-maintained and schema-checked. Do not add one-off generators or broad rewrites unless the user explicitly asks for that migration.
- **OAuth/Auth**: Prefer Better Auth provider APIs and shared URL helpers over hand-built OAuth/DCR/JWKS/cookie logic. Watch for doubled `/api/auth` paths, audience/resource mismatches, and public PKCE vs trusted-client boundaries.
- **REST/MCP parity**: When changing one surface, check the matching contract JSON, REST route, MCP tool, OpenAPI annotation, and seeded E2E/integration coverage.
- **Shared seed tests**: Do not mutate canonical seed records in parallel tests. Use unique temporary records, cleanup, `DEV_SEED_ANCHOR`, and serial E2E execution for shared user state.
- **Tooling/runtime**: Scripts that run in Docker/CI/Copilot must use the same Bun-based setup and generated Prisma client as the workflows.
