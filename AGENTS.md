# Life@USTC Server - Agent Guide

SvelteKit campus workspace with REST + MCP APIs. This is the canonical coding-agent instruction file; nested `AGENTS.md` files only add scoped rules.

## Repo Map

```text
src/routes/           SvelteKit pages, layouts, REST handlers, OAuth/MCP routes
src/features/         Domain logic and feature-owned components
src/lib/              Infrastructure helpers: auth, API, DB, MCP, OAuth, storage, time
src/components/       Shared UI components and layout primitives
messages/             i18n strings (`zh-cn`, `en-us`)
prisma/               Prisma schema and migrations
docs/features/        JSON feature contracts checked against schema/API/MCP parity
tests/                Unit, integration MCP harness, and Playwright E2E tests
tools/                Build, check, seed, import, E2E, and snapshot scripts
.github/workflows/    CI/CD workflows
```

## Commands

```bash
# Development
bun install --frozen-lockfile
bun run dev        # Host app dev; auto-runs prisma generate + migrate deploy
bun run dev:infra  # Infra only (postgres, minio, minio-setup)
bun run dev:docker # Full dev stack in Docker
bun run dev:down   # Stop dev Docker stack

# Quality
bun run check --write        # Lint + format fixes
bun run verify:edit         # After a small edit: lint + typecheck
bun run verify:feature      # After a feature: static checks + typecheck + unit tests
bun run verify:commit       # Before commit/PR: default local gate
bun run verify:full         # Full gate: fast verification + integration + E2E
bun run verify:e2e          # E2E convention check; start MinIO/migrations explicitly

# Tests
bun run test                # Unit only
bun run test:integration    # Integration; runs shared dev-seed setup automatically
bun run test:e2e            # E2E (full build)
bun run test:e2e:artifacts  # Prebuild + typecheck + standalone E2E runtime
bun run test:e2e:prepare    # Build and stage standalone output for E2E

# Build
bun run build:artifacts      # Generate Prisma + OpenAPI
bun run build
docker build .

# Tool CLIs used by repo workflows
bun run prisma generate
bun run prisma migrate dev
bun run prisma migrate reset
bun run prisma studio

```

## Agent Operating Contract

- Treat this file as the compact project contract. Before touching a scoped area, also read the nearest `AGENTS.md`; closer files override broader guidance.
- Keep durable rules here short and actionable. Move repeated, specialized workflows into the closest scoped `AGENTS.md` or a checked-in skill instead of bloating root guidance.
- Keep `AGENTS.md` as the canonical agent instruction surface. Do not add parallel files such as `copilot-instructions.md`, `CLAUDE.md`, or `GEMINI.md` unless the user explicitly asks for a compatibility shim.
- For non-trivial changes, work in this loop: inspect code/docs first, plan the smallest safe edit, implement, run the relevant gate, inspect the diff, and verify the final behavior against the user request.
- Done means evidence-backed: cite the files changed, commands run, and any skipped checks with the reason. Passing tests alone is not enough if they do not cover the requested behavior.
- Do not infer contracts from old docs, generated files, or optimistic commit messages. Check the source of truth: route handlers, Prisma schema/migrations, feature JSON, tests, and current package scripts.
- Think forward: prefer clean, simple, durable code over monkeypatches, brittle one-off shortcuts, or fixes that knowingly leave avoidable tech debt.
- Inspect `git diff` before the final answer. Call out unverified commands, risky changes, and any docs updates intentionally skipped.
- Do not rewrite git history, remove attribution, or force-push unless the user explicitly asks for that operation in the current task.
- Update the nearest `AGENTS.md` when repeated agent mistakes reveal missing durable guidance; keep the change concise and operational.

## Architecture Boundaries

- Keep `src/routes` thin: routing, pages, handlers, metadata. Put domain logic in `src/features`.
- Keep `src/lib` for infrastructure helpers and cross-cutting utilities, not feature rules.
- Keep shared `src/components` free of feature-specific data fetching and mutations.
- REST, MCP, feature JSON, OpenAPI annotations, and tests are coupled surfaces; check all matching surfaces when one changes.
- Treat `prisma/schema.prisma`, migrations, route handlers, feature JSON, and tests as source of truth over stale docs or generated output.

## Shared Test Seed

- Canonical seeded fixture data lives in `tests/e2e/fixtures/scenario.json`; `tools/dev/seed/seed-dev-scenarios.ts` materializes it and `tools/dev/seed/dev-seed.ts` exports the named constants used by tests.
- The shared anchor comes from `DEV_SEED_ANCHOR` in `tools/dev/seed/dev-seed.ts`. Use `.date` for bare date filters, `.recommendedAtTime` for time-sensitive tool calls, and `.startOfDayAtTime` when a test needs the seed day boundary.
- `bun run test:integration` already seeds the shared scenario data; if you invoke Vitest integration specs directly, run `bun run dev:seed-scenarios` first.
- Scoped `tests/**/AGENTS.md` files should only add layer-specific caveats and link shared commands/setup back here or to helper files such as `tests/integration/utils/mcp-harness.ts`.

## Local Dev Environment

- `.env` is configured for host-native dev (`bun run dev`) against local Docker infra on `127.0.0.1`.
- `docker-compose.dev.yml` can also run the SvelteKit dev server via profile `app`; in that mode Compose overrides `DATABASE_URL` and S3 endpoint to use service DNS names.
- `minio-setup` auto-creates bucket `life-ustc-dev` and exits successfully; that is expected.
- Both host-native `bun run dev` and compose app dev auto-run `prisma generate` + `prisma migrate deploy` before starting the SvelteKit dev process.
- The compose app exposes a healthcheck via `bun run health`.
- Host-native `bun run dev` and compose app dev are pinned to `127.0.0.1:3000`; run only one app server at a time.
- Prefer these flows for pain-free setup:
  1. `bun run dev:docker` for one-command full stack
  2. `bun run dev:infra && bun run dev` for host-native app dev

## Documentation Structure

```
docs/index.md          Navigation map for repo docs
docs/features/          Feature specs (modular JSON)
  _meta.json           Product metadata
  _product.json        Roles, workflow
  _models.json         Prisma models
  _enums.json          Enums
  _ui.json             UI patterns
  _cases.json          Cross-feature scenarios
  _audit.json          Audit actions
  user.json            Feature modules
  course.json          ...
  ...

src/*/AGENTS.md         Scoped implementation guides
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
- **Scripts**: Use `createToolPrisma()` / `disconnectToolPrisma()` from `@tools/shared/tool-prisma`

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
- `public/openapi.generated.json`

**Feature Changes**:
1. Update `docs/features/<module>.json` first
2. Implement code
3. Run `bun run verify:commit`
4. Update tests, then escalate to `bun run verify:full` when the change touches integration or browser flows

**Documentation Alignment**:
- Public REST API change → update route OpenAPI annotations, `docs/features/openapi.json` when relevant, then run `bun run build:artifacts`.
- MCP tool/parameter/output change → update the matching `docs/features/<module>.json` and integration coverage.
- User-visible behavior change → update the affected feature JSON and user-facing docs if present.
- Architecture or dependency-boundary change → update `docs/index.md`, the nearest scoped `AGENTS.md`, or an ADR/runbook if one exists.
- Operational/setup/config change → update `README.md`, `docs/index.md`, workflow docs, or `.env.example` as applicable.
- If no docs update is needed, state why in the final summary.

**Security & Privacy**:
- Never log tokens, secrets, session cookies, OAuth codes, upload URLs, or personal data beyond what a test explicitly requires.
- Preserve auth surface differences: pages redirect, REST returns status responses, MCP is bearer-only with `/api/mcp` audience.
- Check permissions before mutations; suspended users are blocked from collaborative writes.
- Upload downloads are owner-scoped unless a feature change explicitly updates the permission model and docs.

**Documentation Changes**:
- Ask before broad documentation rewrites or restructures when the user did not explicitly request doc edits.
- When docs must change as part of code work, keep the edits narrow and run the same default gate.

**Default Verification**:
- Use `bun run verify:commit` for most commits and PR updates.
- Use `bun run verify:full` before pushing changes that affect data flows, auth, browser flows, docs contracts, or shared tooling.
- Use `bun run verify:e2e` before `bun run test:e2e`.

**No Stray Reports**:
- Do not leave migration plans, improvement reports, status summaries, scratch artifacts, or one-time analysis outputs in the repo.
- Temporary planning files, local verification scripts, ad hoc probes, and throwaway code are acceptable only if removed before finishing.
- Before handoff, inspect `git status --short` and ensure only intentional durable source, docs, config, or test changes remain.
- Use GitHub issues/PRs for durable tracking

**PR / Change Summary**:
- Summaries should name changed files, behavior/doc impact, commands run, skipped checks with reasons, and residual risks.
- Review the diff for unrelated rewrites, generated-file edits, missing docs/tests, and REST/MCP parity gaps before handing off.

## Scoped Guides

- **Features**: `docs/features/<module>.json` - Specifications
- **Source**: `src/AGENTS.md` - Organization
- **Routes**: `src/routes/` - SvelteKit pages and REST handlers
- **MCP**: `src/lib/mcp/AGENTS.md` - MCP tools
- **Features**: `src/features/AGENTS.md` - Business logic
- **Components**: `src/components/AGENTS.md` - UI
- **Prisma**: `prisma/AGENTS.md` - Schema
- **Tests**: `tests/{e2e,integration,unit}/AGENTS.md` (layer-specific notes only)
- **Tools**: `tools/AGENTS.md` - Scripts
- **CI/CD**: `.github/workflows/AGENTS.md`

## Known Issues

**Better Auth social providers**: Profile types must match library exactly:
- `GithubProfile.email` is `string | null` not `string | undefined`
- Mismatches break typecheck and Docker build

## Agent Audit Guardrails

History shows agent-assisted changes in this repo most often went wrong when they trusted stale shape assumptions or created convenience artifacts that later had to be removed. Guard against these patterns:

- **Feature docs**: Keep feature JSON hand-maintained and schema-checked. Do not add one-off generators or broad rewrites unless the user explicitly asks for that migration.
- **OAuth/Auth**: Prefer Better Auth provider APIs and shared URL helpers over hand-built OAuth/DCR/JWKS/cookie logic. Watch for doubled `/api/auth` paths, audience/resource mismatches, and public PKCE vs trusted-client boundaries.
- **REST/MCP parity**: When changing one surface, check the matching feature JSON, REST route, MCP tool, OpenAPI annotation, and seeded E2E/integration coverage.
- **Shared seed tests**: Do not mutate canonical seed records in parallel tests. Use unique temporary records, cleanup, `DEV_SEED_ANCHOR`, and serial E2E execution for shared user state.
- **Tooling/runtime**: Scripts that run in Docker/CI/Copilot must use the same Bun-based setup, generated Prisma client, and bundled production tool paths as the workflows.
