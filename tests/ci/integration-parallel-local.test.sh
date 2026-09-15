#!/usr/bin/env bash
# Exercise real shard orchestration with fake IO, including concurrent failure.
set -euo pipefail
cd "$(dirname "$0")/../.."
test_dir="$(mktemp -d)"
runner_pid=""
cleanup() {
  if [[ -n "$runner_pid" ]]; then
    kill -TERM "$runner_pid" 2>/dev/null || true
    wait "$runner_pid" 2>/dev/null || true
  fi
  rm -rf "$test_dir"
}
trap cleanup EXIT
export PARALLEL_TEST_DIR="$test_dir"
mkdir "$test_dir/bin"
cat >"$test_dir/bin/docker" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >>"$PARALLEL_TEST_DIR/docker.log"
case "$1" in
  port) printf '127.0.0.1:5999%s\n' "${2##*-}" ;;
esac
MOCK
cat >"$test_dir/bin/bun" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
if [[ "$1" == run ]]; then
  [[ "$2" == app:prepare ]]
  exit 0
fi
exec "$PARALLEL_REAL_BUN" "$@"
MOCK
cat >"$test_dir/bin/psql" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
[[ "$1" == "$FUNCTION_OWNER_DATABASE_URL" ]]
printf '%s\n' "$1" >>"$PARALLEL_TEST_DIR/bootstrap.log"
MOCK
cat >"$test_dir/bin/bunx" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
if [[ "$1" == prisma ]]; then
  [[ "$DATABASE_URL" == "$FUNCTION_OWNER_DATABASE_URL" ]]
  exit 0
fi
[[ "$1" == vitest && "$2" == run ]]
[[ "$DATABASE_URL" == *life_ustc_runtime:* ]]
[[ "$AUTH_DATABASE_URL" == *life_ustc_auth_runtime:* ]]
[[ "$MAINTENANCE_DATABASE_URL" == *life_ustc_maintenance_runtime:* ]]
[[ "$DATABASE_URL" != "$FUNCTION_OWNER_DATABASE_URL" ]]
[[ "$RLS_TEST_ENABLED" == true ]]
[[ "$AUTH_ROLE_TEST_ENABLED" == true ]]
[[ "$FUNCTION_OWNER_ROLE_TEST_ENABLED" == true ]]
[[ "$MAINTENANCE_ROLE_TEST_ENABLED" == true ]]
[[ "$CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE" == "$DATABASE_URL" ]]
[[ "$*" == *'test-filter --reporter=dot'* ]]
shard="${5#--shard=}"
printf '%s %s\n' "$shard" "$DATABASE_URL" >>"$PARALLEL_TEST_DIR/tests.log"
touch "$PARALLEL_TEST_DIR/started-${shard%/*}"
if [[ "${PARALLEL_HANG:-}" == true ]]; then
  echo "$$" >"$PARALLEL_TEST_DIR/pid-${shard%/*}"
  exec sleep 30
fi
# Neither process can finish until both are running: catches serial orchestration.
for attempt in $(seq 1 500); do
  if [[ -f "$PARALLEL_TEST_DIR/started-1" && -f "$PARALLEL_TEST_DIR/started-2" ]]; then
    if [[ "${PARALLEL_FAIL_SHARD:-}" == "$shard" ]]; then
      echo "Deliberate shard failure" >&2
      exit 7
    fi
    exit 0
  fi
  sleep 0.02
done
exit 9
MOCK
chmod +x "$test_dir/bin/"*
export PARALLEL_REAL_BUN="$(command -v bun)"
export PATH="$test_dir/bin:$PATH"
unset E2E_BUNX_BIN
unset RLS_TEST_ENABLED AUTH_ROLE_TEST_ENABLED FUNCTION_OWNER_ROLE_TEST_ENABLED MAINTENANCE_ROLE_TEST_ENABLED
export INTEGRATION_SHARDS=2
export INTEGRATION_REPORT_ROOT="$test_dir/reports"
bash tests/ci/integration-parallel-local.sh test-filter --reporter=dot >"$test_dir/success.log" 2>&1
[[ "$(wc -l < "$test_dir/tests.log")" == 2 ]]
[[ "$(sort -u "$test_dir/bootstrap.log" | wc -l)" == 2 ]]
[[ "$(grep -c '^rm -f -v life-ustc-integration-' "$test_dir/docker.log")" == 2 ]]
export PARALLEL_FAIL_SHARD=2/2
if bash tests/ci/integration-parallel-local.sh test-filter --reporter=dot >"$test_dir/failure.log" 2>&1; then
  echo 'A failed shard was incorrectly reported as success.' >&2
  exit 1
fi
[[ -s "$INTEGRATION_REPORT_ROOT/shard-2.log" ]]
[[ "$(grep -c '^rm -f -v life-ustc-integration-' "$test_dir/docker.log")" == 4 ]]
rm "$test_dir/started-1" "$test_dir/started-2"
PARALLEL_HANG=true bash tests/ci/integration-parallel-local.sh test-filter --reporter=dot >"$test_dir/interrupted.log" 2>&1 &
runner_pid="$!"
for attempt in $(seq 1 500); do
  if [[ -f "$test_dir/pid-1" && -f "$test_dir/pid-2" ]]; then break; fi
  sleep 0.02
done
kill -TERM "$runner_pid"
exit_code=0
wait "$runner_pid" || exit_code="$?"
runner_pid=""
[[ "$exit_code" == 143 ]]
for shard in 1 2; do
  if kill -0 "$(cat "$test_dir/pid-$shard")" 2>/dev/null; then
    echo "Interrupted shard $shard left a live test process." >&2
    exit 1
  fi
done
[[ "$(grep -c '^rm -f -v life-ustc-integration-' "$test_dir/docker.log")" == 6 ]]
for invalid_role_test_flag in \
  RLS_TEST_ENABLED \
  AUTH_ROLE_TEST_ENABLED \
  FUNCTION_OWNER_ROLE_TEST_ENABLED \
  MAINTENANCE_ROLE_TEST_ENABLED; do
  if env "$invalid_role_test_flag=false" \
    bash tests/ci/integration-parallel-local.sh >/dev/null 2>&1; then
    echo "$invalid_role_test_flag=false was incorrectly accepted." >&2
    exit 1
  fi
done
if INTEGRATION_SHARDS=0 bash tests/ci/integration-parallel-local.sh >/dev/null 2>&1; then
  echo 'Invalid shard count was accepted.' >&2
  exit 1
fi
echo 'Parallel integration orchestration passed.'
