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

Playwright request tests (`playwright.api.config.ts`) use the real Worker.
`_harness/actor.ts` supplies `createActor()` with a test-owned user, session and
request context. Use it for ordinary domain cases; keep `_harness/auth.ts` debug
provider sign-in for tests of that login flow. Public domain records require their
own fixture because deleting their author does not necessarily delete the record.

## MCP layout

```text
tests/integration/mcp/
  workspace/ · catalog/ · community/ · bus/
  profile.test.ts
  _harness/      client, context, fixtures, cleanup
```

## Harness (`_harness/`)

- `createMcpHarness` / `createAnonymousMcpHarness` — `client.ts`
- `mcpTest` — native Vitest fixtures with file-owned database connections
- `readerFixture()` — a fresh reader identity for each test
- `actorFixture()` — throwaway user and client injected into each mutation test
- `academicActorFixture()` — isolated user + private academic fixture
  (`sectionId`, `sectionJwId`, `sectionCode`); shared metadata stays read-only
- `createEphemeralMcpUser()` — single-`it` user; call `close()` after cleanup
- App queries: `createTestPrisma()` from `tests/shared/prisma.ts` (restricted role).
- Fixture setup, cleanup, and authoritative DB assertions: `createFixturePrisma()`.
  Never pass that owner client into application services or add user context around
  a service call to compensate for missing context inside the application.

The MCP in-memory client verifies tool behavior and serialization; real Worker
HTTP authentication is a separate layer. `fileParallelism` remains off for the
overall integration suite while remaining shared actors and global operations are
migrated. Maintenance and Prometheus scenarios now use per-test databases;
per-test identities alone do not isolate database-wide operations.

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

Global maintenance and aggregate tests can use `isolatedDatabaseTest` from
`tests/shared/isolated-database.ts`. A file-scoped, schema-only PostgreSQL dump
preserves the source functions, owners, grants and RLS; each case clones its own
empty database and uses explicit owner/app/auth/maintenance clients. Tests arrange
their own rows. Teardown closes clients and drops only those generated databases.
The elevated fixture account needs database creation/deletion privileges.
Put `pg_dump` matching the PostgreSQL server major on `PATH` (PostgreSQL 16 in CI
and the local Docker runners); `psql` must also be available. For Debian/Ubuntu,
install `postgresql-client-16` and prepend `/usr/lib/postgresql/16/bin` to `PATH`.
The harness rejects a mismatched dump client; it does not rewrite schema SQL.

## Conventions

- `DEV_SEED_ANCHOR` from `tests/fixtures/dev-seed.ts`
- Mutation markers: `[integration-test] ...`
- Clean up created data; pass explicit `userId` into audit helpers when isolated
