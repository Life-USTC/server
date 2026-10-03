#!/usr/bin/env bash
# Verify that interruption and early failure release the one local database and
# detached Worker descendants without touching an unrelated process group.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
local_script_source="${repo_root}/tests/ci/e2e-local.sh"
process_groups_source="${repo_root}/tests/ci/e2e-process-groups.sh"
source "$process_groups_source"
test_dir="$(mktemp -d)"
runner_pid=""
sentinel_pid=""
sentinel_group=""
sentinel_start_time=""

fail() {
  echo "local E2E cleanup regression failed: $*" >&2
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
    grep -aFzxq -- "E2E_FIXTURE_DIR=${pid_file%/*}" "/proc/${detached_pid}/environ" 2>/dev/null || continue
    kill -KILL -- "-${detached_group}" >/dev/null 2>&1 || true
  done
  rm -rf "$test_dir"
}
trap cleanup EXIT

prepare_fixture() {
  local fixture_root="$1"
  mkdir -p "$fixture_root/tests/ci" "$fixture_root/bin"
  cp "$local_script_source" "$fixture_root/tests/ci/e2e-local.sh"
  cp "$process_groups_source" \
    "$fixture_root/tests/ci/e2e-process-groups.sh"

  cat >"$fixture_root/tests/ci/setup-runtime-database.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

detached_pid_file="${E2E_FIXTURE_DIR}/${E2E_FIXTURE_MODE}-worker.pid"
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

  cat >"$fixture_root/bin/bunx" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
[[ "$*" == 'playwright test --workers=2 selected test' ]]
printf '%s\n' "$@" >"${E2E_FIXTURE_DIR}/playwright-arguments"
trap 'exit 143' INT TERM
while :; do sleep 1; done
EOF

  cat >"$fixture_root/bin/docker" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

case "${1:-}" in
  exec)
    exit 0
    ;;
  rm)
    rm -rf "${E2E_FIXTURE_DIR}/container-${*: -1}"
    exit 0
    ;;
  port)
    printf '127.0.0.1:45000\n'
    ;;
  run)
    while [[ "$1" != --name ]]; do shift; done
    mkdir "${E2E_FIXTURE_DIR}/container-$2"
    active="$(find "$E2E_FIXTURE_DIR" -maxdepth 1 -type d -name 'container-*' | wc -l)"
    [[ "$active" -eq 1 ]] || {
      echo "runner provisioned more than one database" >&2
      exit 55
    }
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
exec "$E2E_REAL_BUN" "$@"
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
  E2E_FIXTURE_DIR="$run_dir" \
  E2E_REAL_BUN="$(command -v bun)" \
  PATH="$fixture_root/bin:$PATH" \
    bash "$fixture_root/tests/ci/e2e-local.sh" --workers=2 'selected test' >"$output_file" 2>&1 &
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

assert_containers_stopped() {
  local run_dir="$1"
  [[ "$(find "$run_dir" -maxdepth 1 -type d -name 'container-*' | wc -l)" -eq 0 ]] ||
    fail "local database survived cleanup"
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

  wait_for_detached_fixture "$run_dir" normal 1 || {
    sed -n '1,240p' "$run_dir/runner.log" >&2
    fail "local runner did not start its owned Worker fixture"
  }

  for _ in $(seq 1 100); do
    [[ -f "$run_dir/playwright-arguments" ]] && break
    sleep 0.01
  done
  printf '%s\n' playwright test --workers=2 'selected test' >"$run_dir/expected-arguments"
  diff -u "$run_dir/expected-arguments" "$run_dir/playwright-arguments"
  kill -TERM "$runner_pid"
  set +e
  wait "$runner_pid"
  runner_exit_code="$?"
  set -e
  runner_pid=""
  [[ "$runner_exit_code" == 143 ]] ||
    fail "local runner returned ${runner_exit_code} after interrupt"

  assert_detached_processes_stopped "$run_dir" normal
  assert_containers_stopped "$run_dir"
  process_is_alive "$sentinel_pid" || fail "cleanup killed an unrelated process group"
  stop_sentinel
}

run_early_failure() {
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
  [[ "$runner_exit_code" == 42 ]] ||
    fail "early runner exit returned ${runner_exit_code}"

  detached_count="$(find "$run_dir" -maxdepth 1 -name 'early-exit-*.pid' -type f | wc -l)"
  [[ "$detached_count" == 1 ]] ||
    fail "early failure did not start exactly one detached fixture"
  assert_detached_processes_stopped "$run_dir" early-exit
  assert_containers_stopped "$run_dir"
  process_is_alive "$sentinel_pid" || fail "early-exit cleanup killed an unrelated process group"
  stop_sentinel
}

run_normal_cancellation
run_early_failure
echo "local E2E process and database cleanup regression passed"
