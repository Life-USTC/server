---
name: life-ustc-dev-loop
description: "Single source of truth for the Life@USTC server local development loop: setup, checks, tests, verification, and handoff to PR workflow. CI phase scripts live in .github/workflows/db-backed-bun-job.yml and should stay intentionally aligned."
---

# Life@USTC Dev Loop

Canonical **local** command order for the server repo. Run these from the shell
or via subagents. CI phases are defined in
`.github/workflows/db-backed-bun-job.yml` (`ci:verify`, `ci:integration`, …) —
keep this skill and those phases in sync when either changes.

`package.json` may expose CI/convenience aliases (`rest:test`, `e2e:test`,
`openapi:check`, …). **Order and which gates to run** are defined here, not by
discovering scripts ad hoc.

## Core constraints

- Domain / use-case logic lives in `src/features/*/server`. Keep `src/routes`
  thin (transport, pages, wiring only).
- Feature UI for the signed-in workspace lives under `src/features/dashboard/`
  but Web routes are `/workspace/*` — do not invent a parallel `workspace`
  feature folder.
- Domain and route code import runtime only through `src/lib/ports/`.
- Native IO (`node:*`, `bun:*`, `fs`, `path`, `child_process`, direct `process`
  usage) belongs in `src/lib/adapters/`, approved infra (e.g. `src/lib/auth`,
  `src/lib/db`, `src/lib/log`, `src/lib/cloudflare`), or entrypoints such as
  `src/static-loader/` and `features/*-cli.ts` — not in ordinary features or
  routes.

## 1. Start dev environment

Needs Bun (`.bun-version`), Docker Compose, and host `psql` (seed uses
`prisma/seed.sh`).

```bash
bun install --frozen-lockfile
bun run hooks:install
cp .env.example .env
docker compose -f docker-compose.dev.yml up -d
bun run app:prepare
bun run db:migrate:deploy
bunx prisma db seed
bun run dev
```

- App listens at `http://127.0.0.1:3000` — do not override ports/proxies locally.
- Local `.env` may use a single `DATABASE_URL`; Better Auth can fall back to it.
  Do not require production-style separate `AUTH_DATABASE_URL` for default local
  work (see `docs/operations.md` for production).
- First browser / REST Playwright / E2E run:
  `bunx playwright install --with-deps chromium` (or `bunx playwright install chromium`).
- Upload/object storage in E2E and Worker flows uses Wrangler local `R2_UPLOADS`.
  Do not add MinIO/S3 emulation unless a test specifically covers it.

## 2. Make changes

- Implement use-cases in `src/features/*/server`; adapt in routes / GraphQL / MCP.
- Put new runtime behind ports/adapters (or approved infra — see Core constraints).
- Prefer not to add new TypeScript command orchestrators; extend this skill or
  package aliases instead.

## 3. Run checks — dispatch a subagent

Default local gate (mirrors most of CI `ci:verify`, minus a few CI-only scripts):

```bash
bun run app:prepare
bunx wrangler types --include-runtime=false --check
bunx biome check
bunx svelte-check --tsconfig ./tsconfig.json
bunx tsc --noEmit -p tsconfig.typecheck.json
bunx tsc --noEmit -p tsconfig.typecheck.tests.json
bunx tsc --noEmit -p tsconfig.typecheck.operational.json
bunx vitest run
```

When REST OpenAPI JSDoc or public REST shape changed, also run:

```bash
bun run openapi:check
```

When GraphQL schema / contracts changed, also run:

```bash
bunx vitest run tests/unit/graphql-schema-snapshot.test.ts
# After intentional SDL updates: rerun with --update, then without --update
```

CI `ci:verify` additionally runs `tests/ci/{retry,seed-guard,e2e-full-suite-parity}.test.sh`
and a base-ref GraphQL compatibility step on PRs — run those when touching the
matching scripts or when CI fails on them.

Subagent: run in order, stop on first failure, report pass/fail per step.

## 4. Run integration tests — dispatch a subagent

Aligns with CI `ci:integration` (MCP vitest + REST Playwright):

```bash
bun run db:migrate:deploy
bunx prisma db seed
bunx vitest run --config vitest.integration.config.ts
bun run build
bun run rest:test
```

`rest:test` needs Playwright Chromium and a free path to start `e2e:server`.
See `tests/integration/AGENTS.md` for harness rules.

## 5. Run E2E tests — dispatch a subagent

```bash
bun run db:migrate:deploy
bunx prisma db seed
bun run app:prepare
bun run build
bun run e2e:test
```

Playwright starts the Worker via `bun run e2e:server`. `e2e:test` is the sharded
CI parity suite. A bare `playwright test` reuses one seed and is not a release
gate.

## 6. Manual checklist before PR

Scripts cannot check these:

- Updated `docs/contracts/*.json` when behavior, permissions, or workflow changed.
- Ran `bun run openapi:check` when REST shapes / OpenAPI JSDoc changed.
- Ran GraphQL SDL snapshot when schema changed.
- Explicit REST / GraphQL / MCP parity decision when one public surface changed.
- Seeded coverage for the changed behavior.
- No native IO in ordinary features/routes (see Core constraints).
- No stray scratch reports, Playwright output, or probes left in the tree.

## 7. UI verification — dispatch a subagent

For user-visible changes:

1. Smallest screen/journey that exercises the change.
2. Focused Playwright: `bunx playwright test <path>` (after seed/build as needed).
3. Inspect screenshot, headed run, or trace.
4. Delete local screenshots/traces before committing.

## 8. API surface verification — dispatch a subagent

For REST / GraphQL / MCP changes (routes, tools, fields, auth, status, dates):

1. List coupled surfaces: feature use-case, transport adapter, contract JSON, tests.
2. Decide parity across REST / GraphQL / MCP explicitly (document intentional gaps).
3. Exercise one public request or tool call when feasible.
4. Compare serialized output with contracts/tests; redact secrets and PII.

## 9. Open PR — `$life-ustc-pr-workflow`

Commit, push, open/update PR, watch CI/Cloudflare, address review, merge.
Do not rewrite history or force-push.

## 10. Static loader

```bash
docker build --target loader -t life-ustc-static-loader:check .
docker run --rm -e DATABASE_URL="$DATABASE_URL" -e STATIC_SNAPSHOT_URL="<snapshot-url>" life-ustc-static-loader:check
```

## Stop local services

```bash
docker compose -f docker-compose.dev.yml down
```
