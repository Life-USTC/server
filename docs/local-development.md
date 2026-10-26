# Database-backed tests locally

Run these commands from the server repository root.

Follow the [README quick start](../README.md#quick-start) for application setup
and `bun run check`. The tests below need Docker and PostgreSQL 16 clients
(`psql` and `pg_dump`), a disposable database, and separate app/auth/maintenance
roles, including the static importer. First Playwright run:
`bunx playwright install --with-deps chromium`.

```bash
# Disposable test service, separate from the development database.
docker run --detach --rm --name life-ustc-test \
  --env POSTGRES_DB=life_ustc_test --env POSTGRES_USER=postgres \
  --env POSTGRES_PASSWORD=postgres --publish 127.0.0.1:55432:5432 postgres:16
# Continue once this reports "accepting connections".
docker exec life-ustc-test pg_isready -U postgres -d life_ustc_test

# Keep test credentials out of the development shell after this block exits.
(
set -e
export FUNCTION_OWNER_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:55432/life_ustc_test"
export DATABASE_URL="postgresql://life_ustc_runtime:runtime-test-password@127.0.0.1:55432/life_ustc_test"
export AUTH_DATABASE_URL="postgresql://life_ustc_auth_runtime:auth-runtime-test-password@127.0.0.1:55432/life_ustc_test"
export MAINTENANCE_DATABASE_URL="postgresql://life_ustc_maintenance_runtime:maintenance-runtime-test-password@127.0.0.1:55432/life_ustc_test"
export IMPORTER_DATABASE_URL="postgresql://life_ustc_importer:importer-test-password@127.0.0.1:55432/life_ustc_test"
export CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE="$DATABASE_URL"
export CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_AUTH="$AUTH_DATABASE_URL"
export CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_MAINTENANCE="$MAINTENANCE_DATABASE_URL"
export AUTH_SECRET=e2e-dev-secret-not-for-production
bun run app:prepare
DATABASE_URL="$FUNCTION_OWNER_DATABASE_URL" bunx prisma migrate deploy
psql "$FUNCTION_OWNER_DATABASE_URL" -X --quiet --single-transaction \
  --file=tests/integration/fixtures/rls-runtime-bootstrap.sql

# Include every role contract in a complete local integration run.
export RLS_TEST_ENABLED=true AUTH_ROLE_TEST_ENABLED=true
export FUNCTION_OWNER_ROLE_TEST_ENABLED=true MAINTENANCE_ROLE_TEST_ENABLED=true
bunx vitest run --config vitest.integration.config.ts

# Native filters, projects and worker counts pass directly to Playwright.
bun run build && bun run build:test-worker
bun run rest:test
bun run e2e:test --workers=2
)

# Stop this service explicitly after testing, including after interrupted runs.
docker rm -f -v life-ustc-test
```

The [CI database action](../.github/actions/setup-test-database/action.yml) uses
the same migration and role bootstrap. HTTP/browser tests use the application
and precompiled Worker in `.svelte-kit/test-worker`; rebuild both in the order
above after changing application or Worker fixture code. Upload tests use
Wrangler local `R2_UPLOADS`.

Fixtures clean up their resources, but the PostgreSQL source service stays up
until explicitly stopped. Force-killing a runner can bypass teardown; remove
only that run's remaining processes and recorded temporary directories.
See [test runtime](test-runtime.md) for fixture choices and ownership contracts.
