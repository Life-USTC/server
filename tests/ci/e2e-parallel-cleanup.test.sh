#!/usr/bin/env bash
# Verify that local E2E cleanup handles both an interrupted runner and a shard
# that exits before the parent reaches its EXIT trap. The detached fixture
# carries the same run marker as its shard so cleanup can identify it without
# matching process names or touching an unrelated process group.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
parallel_script_source="${E2E_PARALLEL_SCRIPT_SOURCE:-${repo_root}/tests/ci/e2e-parallel-local.sh}"
local_shard_script_source="${E2E_LOCAL_SHARD_SCRIPT_SOURCE:-${repo_root}/tests/ci/e2e-local-shard.sh}"
process_groups_source="${E2E_PROCESS_GROUPS_SOURCE:-${repo_root}/tests/ci/e2e-process-groups.sh}"
expected_shard_total="${E2E_EXPECTED_SHARD_TOTAL:-8}"
source "$process_groups_source"
test_dir="$(mktemp -d)"
test_base_port=$((50000 + ($$ % 1000) * 8))
test_inspector_base_port=$((test_base_port + 100))
runner_pid=""
sentinel_pid=""
sentinel_group=""
sentinel_start_time=""

fail() {
  echo "parallel E2E cleanup regression failed: $*" >&2
  exit 1
}

process_is_alive() {
  local pid="$1"
  kill -0 "$pid" >/dev/null 2>&1 || return 1

  local process_state
  process_state="$(ps -o stat= -p "$pid" 2>/dev/null | tr -d '[:space:]')"
  [[ -n "$process_state" && "$process_state" != Z* ]]
}

cleanup() {
  if [[ -n "$runner_pid" ]] && process_is_alive "$runner_pid"; then
    kill -TERM "$runner_pid" >/dev/null 2>&1 || true
    wait "$runner_pid" >/dev/null 2>&1 || true
  fi
  stop_sentinel
  local pid_file
  local detached_pid
  local detached_start_time
  local detached_group
  for pid_file in "$test_dir"/*-run/*-*.pid.identity; do
    [[ -f "$pid_file" ]] || continue
    read -r detached_pid detached_start_time detached_group <"$pid_file" || continue
    [[ "$detached_pid" =~ ^[1-9][0-9]*$ ]] || continue
    [[ "$detached_start_time" =~ ^[1-9][0-9]*$ ]] || continue
    [[ "$detached_group" =~ ^[1-9][0-9]*$ ]] || continue
    ((detached_group > 1)) || continue
    [[ "$(e2e_process_start_time "$detached_pid" 2>/dev/null || true)" == "$detached_start_time" ]] || continue
    [[ "$(e2e_process_group_for_pid "$detached_pid")" == "$detached_group" ]] || continue
    grep -aFzxq -- "PARALLEL_FIXTURE_DIR=${pid_file%/*}" "/proc/${detached_pid}/environ" 2>/dev/null || continue
    kill -KILL -- "-${detached_group}" >/dev/null 2>&1 || true
  done
  rm -rf "$test_dir"
}
trap cleanup EXIT

prepare_fixture() {
  local fixture_root="$1"
  mkdir -p "$fixture_root/tests/ci" "$fixture_root/bin"
  cp "$parallel_script_source" \
    "$fixture_root/tests/ci/e2e-parallel-local.sh"
  cp "$local_shard_script_source" \
    "$fixture_root/tests/ci/e2e-local-shard.sh"
  cp "$process_groups_source" \
    "$fixture_root/tests/ci/e2e-process-groups.sh"

  cat >"$fixture_root/tests/ci/setup-runtime-database.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

fixture_shard="${E2E_REPORT_ROOT##*-}"
detached_pid_file="${PARALLEL_FIXTURE_DIR}/${E2E_FIXTURE_MODE}-${fixture_shard}.pid"
setsid bash -c '
  fixture_pid="$BASHPID"
  source tests/ci/e2e-process-groups.sh
  trap "" INT TERM
  printf "%s %s %s\n" "$fixture_pid" \
    "$(e2e_process_start_time "$fixture_pid")" \
    "$(e2e_process_group_for_pid "$fixture_pid")" >"${1}.identity"
  echo "$fixture_pid" >"$1"
  while :; do sleep 1; done
' _ "$detached_pid_file" &

if [[ "${E2E_FIXTURE_MODE}" == early-exit ]]; then
  for _ in $(seq 1 100); do
    [[ -s "$detached_pid_file" ]] && break
    sleep 0.01
  done
  [[ -s "$detached_pid_file" ]] || return 1
  return 42
fi
EOF

  cat >"$fixture_root/tests/ci/e2e-run-shard.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
trap 'exit 143' INT TERM
while :; do sleep 1; done
EOF

  cat >"$fixture_root/bin/docker" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

case "${1:-}" in
  exec|rm)
    exit 0
    ;;
  port)
    suffix="${2##*-}"
    printf '127.0.0.1:%s\n' "$((45000 + suffix))"
    ;;
  run)
    exit 0
    ;;
  *)
    exit 0
    ;;
esac
EOF

  cat >"$fixture_root/bin/bun" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == run && ("${2:-}" == app:prepare || "${2:-}" == build) ]]; then
  exit 0
fi
exec "$PARALLEL_REAL_BUN" "$@"
EOF

  cat >"$fixture_root/bin/psql" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
  chmod +x "$fixture_root/tests/ci/"*.sh "$fixture_root/bin/"*
}

start_sentinel() {
  setsid sleep 60 &
  sentinel_pid="$!"
  sentinel_start_time="$(e2e_process_start_time "$sentinel_pid")"
  sentinel_group="$(ps -o pgid= -p "$sentinel_pid" | tr -d '[:space:]')"
  [[ "$sentinel_group" =~ ^[1-9][0-9]*$ ]] ||
    fail "could not resolve sentinel process group"
}

stop_sentinel() {
  if [[ -n "$sentinel_pid" && -n "$sentinel_group" && -n "$sentinel_start_time" ]] &&
    [[ "$(e2e_process_start_time "$sentinel_pid" 2>/dev/null || true)" == "$sentinel_start_time" ]] &&
    [[ "$(e2e_process_group_for_pid "$sentinel_pid")" == "$sentinel_group" ]]; then
    kill -KILL -- "-${sentinel_group}" >/dev/null 2>&1 || true
  fi
  if [[ -n "$sentinel_pid" ]]; then
    wait "$sentinel_pid" >/dev/null 2>&1 || true
  fi
  sentinel_pid=""
  sentinel_group=""
  sentinel_start_time=""
}

start_runner() {
  local fixture_root="$1"
  local mode="$2"
  local output_file="$3"
  local run_dir="$4"

  E2E_FIXTURE_MODE="$mode" \
  PARALLEL_FIXTURE_DIR="$run_dir" \
  PARALLEL_REAL_BUN="$(command -v bun)" \
  PATH="$fixture_root/bin:$PATH" \
  E2E_BASE_PORT="$test_base_port" \
  E2E_INSPECTOR_BASE_PORT="$test_inspector_base_port" \
  E2E_CONCURRENCY=2 \
    bash "$fixture_root/tests/ci/e2e-parallel-local.sh" >"$output_file" 2>&1 &
  runner_pid="$!"
}

wait_for_detached_fixture() {
  local run_dir="$1"
  local mode="$2"
  local expected_count="$3"

  for _ in $(seq 1 200); do
    local count
    count="$(find "$run_dir" -maxdepth 1 -name "${mode}-*.pid" -type f | wc -l)"
    if ((count >= expected_count)); then
      return 0
    fi
    process_is_alive "$runner_pid" || return 1
    sleep 0.05
  done
  return 1
}

assert_detached_processes_stopped() {
  local run_dir="$1"
  local mode="$2"
  local pid_file
  local detached_pid

  for pid_file in "$run_dir"/"${mode}"-*.pid; do
    [[ -f "$pid_file" ]] || continue
    detached_pid="$(<"$pid_file")"
    if process_is_alive "$detached_pid"; then
      fail "${mode} detached process ${detached_pid} survived cleanup"
    fi
  done
}

run_normal_cancellation() {
  local fixture_root="$test_dir/fixture-normal"
  local run_dir="$test_dir/normal-run"
  mkdir -p "$run_dir"
  prepare_fixture "$fixture_root"
  start_sentinel
  start_runner "$fixture_root" normal "$run_dir/runner.log" "$run_dir"

  wait_for_detached_fixture "$run_dir" normal 2 || {
    sed -n '1,240p' "$run_dir/runner.log" >&2
    fail "parallel runner did not start its bounded active shard set"
  }

  kill -TERM "$runner_pid"
  set +e
  wait "$runner_pid"
  runner_exit_code="$?"
  set -e
  runner_pid=""
  [[ "$runner_exit_code" == 130 ]] ||
    fail "parallel runner returned ${runner_exit_code} after interrupt"

  assert_detached_processes_stopped "$run_dir" normal
  process_is_alive "$sentinel_pid" || fail "cleanup killed an unrelated process group"
  stop_sentinel
}

run_early_shard_exit() {
  local fixture_root="$test_dir/fixture-early"
  local run_dir="$test_dir/early-run"
  mkdir -p "$run_dir"
  prepare_fixture "$fixture_root"
  start_sentinel
  start_runner "$fixture_root" early-exit "$run_dir/runner.log" "$run_dir"

  set +e
  wait "$runner_pid"
  runner_exit_code="$?"
  set -e
  runner_pid=""
  [[ "$runner_exit_code" == 1 ]] ||
    fail "early shard exit returned ${runner_exit_code}"

  detached_count="$(find "$run_dir" -maxdepth 1 -name 'early-exit-*.pid' -type f | wc -l)"
  [[ "$detached_count" == "$expected_shard_total" ]] ||
    fail "early shard fixture started ${detached_count} of ${expected_shard_total} partitions"
  assert_detached_processes_stopped "$run_dir" early-exit
  process_is_alive "$sentinel_pid" || fail "early-exit cleanup killed an unrelated process group"
  stop_sentinel
}

run_normal_cancellation
run_early_shard_exit
echo "parallel E2E detached-process cleanup regression passed"
