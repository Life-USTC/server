# tests/integration/

Vitest database, authentication, GraphQL and MCP integration tests, plus
Playwright HTTP contracts. Full recipes: root `AGENTS.md`.

```bash
export FUNCTION_OWNER_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/life_ustc_test"
export ALLOW_TEST_DATABASE_SETUP=true
source tests/ci/setup-runtime-database.sh
bunx vitest run --config vitest.integration.config.ts
bun run build && bun run build:test-worker && bun run rest:test
```

Test setup applies migrations and production-equivalent roles, with no demo seed
or shared RLS rows. RLS fixtures arrange their actors and records in private clones.
Native Vitest and Playwright commands can use the four already-prepared database
URLs without rerunning setup.
CI names the mixed Vitest suite `Integration` and the real Worker suite `HTTP`.
HTTP uses eight native case shards with `--fully-parallel --workers=2`; Vitest
retains four shards with serial files.
HTTP cases load immutable compiled Worker code from `.svelte-kit/test-worker`.
CI shares it through `test-build`; manual runs rebuild it after application or
Worker fixture changes. Each case retains its own Worker, database and storage.

## REST (`tests/integration/rest/`)

Playwright request tests (`playwright.api.config.ts`) use the real Worker.
All REST cases use private fixtures extending `tests/e2e/utils/owned-worker.ts`. Prepare their
catalog through `isolatedWorker.database.owner` and create private users, sessions
and request contexts with `isolatedWorker.createActor()`. Wrap complete setup and
test workflows in `run()`, including response consumption and independent state
observations. Its teardown waits for admitted work before disposing requests,
the Worker and its database; it does not roll back a timed-out operation.
Use the actual debug-provider sign-in flow when testing login itself.

## MCP layout

```text
tests/integration/mcp/
  workspace/ · catalog/ · community/ · bus/
  profile.test.ts
  _harness/      SDK client, private runtime, domain fixtures, audit observer
```

## Harness (`_harness/`)

- `createMcpHarness` / `createAnonymousMcpHarness` — `client.ts`
- `isolatedMcpTest` — a native per-test database, restricted-role runtime and owned SDK sessions
- `mcpWorkflow.run()` — explicitly wrap each complete async fixture setup and raw test
  callback, including SDK calls, response consumption, and owner-state observations.
  After async setup, check `signal.throwIfAborted()` before publishing its fixture.
  This keeps native timeout cleanup from disposing a database under a still-running
  callback; a request-only runtime or `aroundEach` does not own that callback.
- `mcpActor` / `mcpOtherActor` — independent actors inside that test's private database
- `mcpSessions.own()` / `ownAnonymous()` — register session ownership before initialization;
  fixture cleanup closes every session before joining complete workflows and then
  in-flight requests, before disposing the runtime/database. Manual `mcpSessions.close()`
  closes sessions only so an admitted workflow cannot wait for itself.
- `mcpSection`, `mcpSchedules`, `mcpBus` and domain fixtures arrange only their explicit rows;
  consumers never read a shared seeded graph
- `isolatedDatabase.owner` — authoritative setup and state observations only.
  Never pass the owner client into application services or add user context around
  a service call to compensate for missing context inside the application.
- Direct REST-handler or Web-use-case comparisons must run within `mcpRuntime.run()`;
  their private database bindings still use the application role.

The MCP in-memory client verifies tool behavior and serialization; real Worker
HTTP authentication is a separate layer. `fileParallelism` remains off for the
overall integration suite to bound resource use. Maintenance and Prometheus
scenarios use per-test databases;
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
- Audit observers receive the private database and an explicit `userId`; no eager shared Prisma singleton
