# tests/integration/

Vitest database, authentication, GraphQL and MCP integration tests, plus
Playwright HTTP contracts. Full recipes: root `AGENTS.md`.

```bash
# First prepare the disposable PostgreSQL service and all connections in root AGENTS.md.
export RLS_TEST_ENABLED=true AUTH_ROLE_TEST_ENABLED=true
export FUNCTION_OWNER_ROLE_TEST_ENABLED=true MAINTENANCE_ROLE_TEST_ENABLED=true
bunx vitest run --config vitest.integration.config.ts
bun run build && bun run build:test-worker && bun run rest:test
```

Test setup applies migrations and production-equivalent roles, with no demo seed
or shared RLS rows. RLS fixtures arrange their actors and records in private clones.
Native Vitest and Playwright commands can use the four already-prepared database
URLs without rerunning setup.
CI selects tests by their single native `@Domain/Method` tag and names jobs
`Domain / Method`. Method describes the contract under test: Service, REST,
GraphQL, MCP, ICS or another explicit boundary. A combination can run both Vitest
and Worker request cases in the same job. HTTP uses two native workers; Vitest
files remain serial. Role-gated contracts remain in the separate permissions job.
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

Run the native Vitest command above against the disposable service prepared in
root `AGENTS.md`. Files remain serial. Explicitly enable all four role-test flags
for a complete local run; CI enables them in its permissions job. Stop the source
container yourself after testing, including after an interrupted run.

Global maintenance and aggregate tests can use `isolatedDatabaseTest` from
`tests/shared/isolated-database.ts`. A file-scoped, schema-only PostgreSQL dump
preserves the source functions, owners, grants and RLS; each case clones its own
empty database and uses explicit owner/app/auth/maintenance clients. Tests arrange
their own rows. Teardown closes clients and drops only those generated databases.
The elevated fixture account needs database creation/deletion privileges.
Put `pg_dump` matching the PostgreSQL server major on `PATH` (PostgreSQL 16 in CI
and the documented local service); `psql` must also be available. For Debian/Ubuntu,
install `postgresql-client-16` and prepend `/usr/lib/postgresql/16/bin` to `PATH`.
The harness rejects a mismatched dump client; it does not rewrite schema SQL.

## Conventions

- `DEV_SEED_ANCHOR` from `tests/fixtures/dev-seed.ts`
- Mutation markers: `[integration-test] ...`
- Audit observers receive the private database and an explicit `userId`; no eager shared Prisma singleton
