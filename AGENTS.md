# Life@USTC Server - Agent Guide

SvelteKit campus workspace with REST + GraphQL + MCP. This is the canonical
agent contract; nested `AGENTS.md` files only add layer-specific rules. Commands
and check sequences live in `$life-ustc-dev-loop`.

## Repo Map

```text
src/routes/           SvelteKit pages, layouts, REST/OAuth/MCP handlers
src/features/         Domain use-cases and feature-owned UI
src/lib/              Infrastructure (ports/adapters, GraphQL/MCP, shared UI)
messages/             i18n (`zh-cn`, `en-us`)
prisma/               Schema and migrations
docs/contracts/       Product/API/GraphQL/MCP contracts
tests/                Unit, integration, Playwright E2E
.agents/skills/       Repo skills (`$life-ustc-dev-loop`, `$life-ustc-pr-workflow`)
```

## Agent Operating Contract

- Read this file, then the nearest scoped `AGENTS.md` before editing that area.
- Keep durable rules short; put repeatable workflows in `.agents/skills`.
- Do not add parallel instruction files (`CLAUDE.md`, `copilot-instructions.md`, …)
  or `.codex/skills` unless the user explicitly asks.
- Prefer two passes on non-trivial work: contracts/docs first, then implementation.
- Done means evidence: files changed, commands run, skipped checks with reasons.
- Trust route handlers, Prisma schema/migrations, contract JSON, tests, and
  package scripts over stale docs or generated output.
- Do not rewrite history, remove attribution, or force-push unless asked.
- Update the nearest `AGENTS.md` when repeated agent mistakes show a missing rule.

## Architecture Boundaries

- Keep `src/routes` thin. Domain logic lives in `src/features/*/server`.
- `src/lib` is infrastructure; shared `src/lib/components` must not own feature
  data fetching or mutations.
- Do not call page/REST handlers from features. Surfaces adapt feature use-cases.
- REST, GraphQL, MCP, contract JSON, public schemas, and tests are coupled;
  check matching surfaces when one changes.

## Complete-Loop Checks

- UI: narrowest browser check that exercises the changed screen; inspect
  screenshot/headed run/trace before handoff.
- REST/GraphQL/MCP: decide which surfaces change; exercise one representative
  request or tool call when feasible and compare with contracts/tests.
- Keep probes, traces, and temporary payloads out of the repo unless fixtures.

## Shared Test Seed

Canonical fixtures: `tests/e2e/fixtures/scenario.json`, executable
`prisma/seed.sql`, named exports in `tests/fixtures/dev-seed.ts`
(`DEV_SEED_ANCHOR`: `.date`, `.recommendedAtTime`, `.startOfDayAtTime`).
`$life-ustc-dev-loop` loads the scenario; direct integration runs need
`bunx prisma db seed` (host `psql` required). Layer test guides only add
caveats and link back here.

## Common Patterns

### Auth
- Pages: `requireSignedInUserId()` → `/signin`
- REST: `resolveApiUserId()` (Bearer or cookie)
- GraphQL: bearer-first principal; `/api/graphql` audience; cookies need trusted Origin
- MCP: Bearer only, audience `/api/mcp`; `getUserId(extra.authInfo)`
- Check permissions before mutations; suspended users blocked from collaborative writes

### Dates / Prisma / Errors / i18n
- Input: `parseDateInput`; GraphQL `@db.Date` → Asia/Shanghai day; display via `getShanghaiDay()`
- `import { prisma, getPrisma } from "@/lib/db/prisma"`; localized reads use `getPrisma(locale)`
- API: `handleRouteError` + status helpers; MCP: Zod inputs, let unexpected errors throw
- Locales: `zh-cn` (default), `en-us`; no URL prefix; both message files for user text
- Validation: Zod; pagination: `buildPaginatedResponse`

## File Rules

**Do not edit:** `src/generated/prisma/`, `src/generated/prisma-node/`,
`public/openapi.generated.json`.

**Feature changes:** check `docs/contracts/<module>.json` → implement + tests →
`$life-ustc-dev-loop` (escalate to integration/E2E when data/auth/browser/contracts
change).

**Keep in sync:** REST → OpenAPI JSDoc + `openapi:check`; GraphQL → module +
`graphql.json` + SDL snapshot test; MCP → module contract + integration tests;
user-visible text → both message files; setup/ops → README / `docs/operations.md`
/ workflows AGENTS / `.env.example`.

**Security:** never log tokens, secrets, cookies, OAuth codes, upload URLs, or
excess PII. Preserve auth surface differences. Upload downloads need the shared
permission gate.

**Hygiene:** no stray migration plans or scratch reports in the repo; use GitHub
issues/PRs. PR summaries name files, impact, commands, skips, and risks.

## Scoped Guides

- Docs map: `docs/index.md`
- Contracts: `docs/contracts/AGENTS.md`
- Source / features / lib / GraphQL / MCP / components: under `src/**/AGENTS.md`
- Prisma: `prisma/AGENTS.md`
- Tests: `tests/{e2e,integration,unit}/AGENTS.md`
- CI/CD: `.github/workflows/AGENTS.md`
- Ops: `docs/operations.md`

## Agent Audit Guardrails

- Keep contract JSON hand-maintained; no one-off generators unless asked.
- Prefer Better Auth APIs and shared URL helpers over hand-built OAuth/JWKS logic.
- When changing one surface, check contract, REST, GraphQL SDL, MCP, OpenAPI, and seeded tests.
- Do not mutate canonical seed rows in parallel tests; use temp records + cleanup + serial E2E where needed.
- Docker/CI/Copilot scripts must use the same Bun setup and generated Prisma client as workflows.
