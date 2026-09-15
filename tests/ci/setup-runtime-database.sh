#!/usr/bin/env bash
# Source this script against an explicitly disposable test database. Only
# migrations and fixtures use its owner; application tests use production roles.
set -euo pipefail

: "${FUNCTION_OWNER_DATABASE_URL:?Set FUNCTION_OWNER_DATABASE_URL to the disposable test database owner URL}"
if [[ "${ALLOW_DATABASE_SEED:-}" != "true" ]]; then
  echo "Set ALLOW_DATABASE_SEED=true to prepare the test database." >&2
  return 1 2>/dev/null || exit 1
fi

runtime_setup_bunx="${E2E_BUNX_BIN:-bunx}"
if [[ "${1:-deploy}" == "reset" ]]; then
  DATABASE_URL="$FUNCTION_OWNER_DATABASE_URL" "$runtime_setup_bunx" prisma migrate reset --force
else
  DATABASE_URL="$FUNCTION_OWNER_DATABASE_URL" "$runtime_setup_bunx" prisma migrate deploy
fi
DATABASE_URL="$FUNCTION_OWNER_DATABASE_URL" "$runtime_setup_bunx" prisma db seed
runtime_setup_database="$(bun -e 'console.log(decodeURIComponent(new URL(process.env.FUNCTION_OWNER_DATABASE_URL).pathname.slice(1)))')"
psql "$FUNCTION_OWNER_DATABASE_URL" -X --single-transaction \
  --set=database_name="$runtime_setup_database" \
  --file=tests/integration/fixtures/rls-runtime-bootstrap.sql

runtime_test_url() {
  bun -e 'const url = new URL(process.env.FUNCTION_OWNER_DATABASE_URL); url.username = process.argv[1]; url.password = process.argv[2]; console.log(url.href)' "$1" "$2"
}
export DATABASE_URL="$(runtime_test_url life_ustc_runtime runtime-test-password)"
export AUTH_DATABASE_URL="$(runtime_test_url life_ustc_auth_runtime auth-runtime-test-password)"
export MAINTENANCE_DATABASE_URL="$(runtime_test_url life_ustc_maintenance_runtime maintenance-runtime-test-password)"
export CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE="$DATABASE_URL"
export CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_AUTH="$AUTH_DATABASE_URL"
export CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_MAINTENANCE="$MAINTENANCE_DATABASE_URL"
unset -f runtime_test_url
unset runtime_setup_bunx runtime_setup_database
