#!/usr/bin/env bash
# Verify orchestration credentials without touching a database.
set -euo pipefail
cd "$(dirname "$0")/../.."
test_dir="$(mktemp -d)"
trap 'rm -rf "$test_dir"' EXIT
export PARITY_COMMAND_LOG="$test_dir/commands"
mkdir "$test_dir/bin"
cat >"$test_dir/bin/bunx" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
[[ "$DATABASE_URL" == "$FUNCTION_OWNER_DATABASE_URL" ]]
printf '%s\n' "$*" >>"$PARITY_COMMAND_LOG"
MOCK
cat >"$test_dir/bin/psql" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
[[ "$1" == "$FUNCTION_OWNER_DATABASE_URL" ]]
[[ "$*" == *'--set=database_name=parity'* ]]
[[ "$*" == *'--file=tests/integration/fixtures/rls-runtime-bootstrap.sql'* ]]
printf 'bootstrap\n' >>"$PARITY_COMMAND_LOG"
MOCK
chmod +x "$test_dir/bin/"*
export PATH="$test_dir/bin:$PATH"
unset E2E_BUNX_BIN
export FUNCTION_OWNER_DATABASE_URL='postgresql://postgres:owner@127.0.0.1:59999/parity?sslmode=disable'
export ALLOW_TEST_DATABASE_SETUP=true
source tests/ci/setup-runtime-database.sh
[[ "$DATABASE_URL" == 'postgresql://life_ustc_runtime:runtime-test-password@127.0.0.1:59999/parity?sslmode=disable' ]]
[[ "$AUTH_DATABASE_URL" == 'postgresql://life_ustc_auth_runtime:auth-runtime-test-password@127.0.0.1:59999/parity?sslmode=disable' ]]
[[ "$MAINTENANCE_DATABASE_URL" == 'postgresql://life_ustc_maintenance_runtime:maintenance-runtime-test-password@127.0.0.1:59999/parity?sslmode=disable' ]]
[[ "$CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE" == "$DATABASE_URL" ]]
[[ "$CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_AUTH" == "$AUTH_DATABASE_URL" ]]
[[ "$CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_MAINTENANCE" == "$MAINTENANCE_DATABASE_URL" ]]
source tests/ci/setup-runtime-database.sh
printf '%s\n' 'prisma migrate deploy' bootstrap \
  'prisma migrate deploy' bootstrap >"$test_dir/expected"
diff -u "$test_dir/expected" "$PARITY_COMMAND_LOG"

# Missing owner credentials must fail before running setup, even if DATABASE_URL
# still contains a valid-looking application URL.
if (unset FUNCTION_OWNER_DATABASE_URL; source tests/ci/setup-runtime-database.sh) 2>/dev/null; then
  echo 'Setup accepted missing fixture owner credentials.' >&2
  exit 1
fi
if (export ALLOW_TEST_DATABASE_SETUP=false; source tests/ci/setup-runtime-database.sh) 2>/dev/null; then
  echo 'Setup accepted missing test database setup authorization.' >&2
  exit 1
fi
if (unset ALLOW_TEST_DATABASE_SETUP; export ALLOW_DATABASE_SEED=true; source tests/ci/setup-runtime-database.sh) 2>/dev/null; then
  echo 'Development seed authorization must not authorize test database setup.' >&2
  exit 1
fi
diff -u "$test_dir/expected" "$PARITY_COMMAND_LOG"
grep -Fq '\ir ../../../prisma/roles/production-runtime-bootstrap.sql' \
  tests/integration/fixtures/rls-runtime-bootstrap.sql
if grep -Eq '^(GRANT|REVOKE|ALTER ROLE|CREATE POLICY)' tests/integration/fixtures/rls-runtime-bootstrap.sql; then
  echo 'Test fixtures must not maintain a separate runtime permission contract.' >&2
  exit 1
fi
if grep -Eq '^(INSERT|UPDATE|DELETE)' tests/integration/fixtures/rls-runtime-bootstrap.sql; then
  echo 'Runtime role setup must not write shared application fixtures.' >&2
  exit 1
fi
echo 'Runtime database parity orchestration passed.'
