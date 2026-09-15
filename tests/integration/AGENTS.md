# tests/integration/

MCP in-process harness + REST Playwright contracts. Full recipes: root
`AGENTS.md` (same shape as CI `ci:integration`).

```bash
export FUNCTION_OWNER_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/life_ustc_test"
export ALLOW_DATABASE_SEED=true
source tests/ci/setup-runtime-database.sh
bunx vitest run --config vitest.integration.config.ts
bun run build && bun run rest:test
```

## REST (`tests/integration/rest/`)

REST-only Playwright (`playwright.api.config.ts`) with `_harness/auth.ts`
request-based debug sign-in.

## MCP layout

```text
tests/integration/mcp/
  workspace/ · catalog/ · community/ · bus/
  profile.test.ts
  _harness/      client, context, fixtures, cleanup
```

## Harness (`_harness/`)

- `createMcpHarness` / `createAnonymousMcpHarness` — `client.ts`
- `createMcpToolTestContext()` — shared seed user, read-mostly
- `createIsolatedMcpToolTestContext()` — throwaway user for mutations; read
  `context.client` / `context.userId` at call time (don't destructure early)
- `createSubscribedIsolatedMcpToolTestContext()` — isolated + seed section
- `createEphemeralMcpUser()` — single-`it` user; call `close()` after cleanup
- App queries: `createTestPrisma()` from `tests/shared/prisma.ts` (restricted role).
- Fixture setup, cleanup, and authoritative DB assertions: `createFixturePrisma()`.
  Never pass that owner client into application services or add user context around
  a service call to compensate for missing context inside the application.

`fileParallelism` is off — auth row-count tests flake under concurrent session
writes. Prefer file-level isolation for mutating suites.

Run isolated local shards with `bun run integration:test:parallel`. It creates
four disposable PostgreSQL containers, applies the production role bootstrap to
each, and removes them on exit. Existing databases are not used. Set
`INTEGRATION_SHARDS=1` through `8` to choose concurrency and
`INTEGRATION_REPORT_ROOT` to retain logs at a chosen path. Test filters and role
filters pass through; files inside each shard stay serial. The runner enables
RLS, authentication-role, function-owner, and maintenance-role contract tests
by default. Explicitly setting any of those four gates to a value other than
`true` is rejected so required tests cannot be silently skipped.
The local runner requires Bash, Docker, Bun, `psql`, and Linux `setsid`.

## Conventions

- `DEV_SEED_ANCHOR` from `tests/fixtures/dev-seed.ts`
- Mutation markers: `[integration-test] ...`
- Clean up created data; pass explicit `userId` into audit helpers when isolated
