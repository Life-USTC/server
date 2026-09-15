#!/usr/bin/env bash
# Verify that interrupting the parallel runner also stops detached descendants
# such as Playwright webServer process groups without touching unrelated groups.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
test_dir="$(mktemp -d)"
runner_pid=""
sentinel_pid=""
sentinel_group=""

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
  if [[ -n "$sentinel_group" ]] && kill -0 -- "-${sentinel_group}" >/dev/null 2>&1; then
    kill -KILL -- "-${sentinel_group}" >/dev/null 2>&1 || true
  fi
  rm -rf "$test_dir"
}
trap cleanup EXIT

mkdir -p "$test_dir/fixture/tests/ci" "$test_dir/bin"
cp "$repo_root/tests/ci/e2e-parallel-local.sh" \
  "$test_dir/fixture/tests/ci/e2e-parallel-local.sh"

cat >"$test_dir/fixture/tests/ci/e2e-local-shard.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

shard="$1"
setsid bash -c '
  echo "$$" >"${PARALLEL_FIXTURE_DIR}/detached-${1}.pid"
  trap "" INT TERM
  while :; do sleep 1; done
' _ "$shard" &

trap 'exit 143' INT TERM
while :; do sleep 1; done
EOF
chmod +x "$test_dir/fixture/tests/ci/e2e-local-shard.sh"

cat >"$test_dir/bin/docker" <<'EOF'
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

cat >"$test_dir/bin/bun" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == run && ("${2:-}" == app:prepare || "${2:-}" == build) ]]; then
  exit 0
fi
exec "$PARALLEL_REAL_BUN" "$@"
EOF

cat >"$test_dir/bin/psql" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
chmod +x "$test_dir/bin/"*

export PARALLEL_FIXTURE_DIR="$test_dir"
export PARALLEL_REAL_BUN="$(command -v bun)"
export PATH="$test_dir/bin:$PATH"
export E2E_BASE_PORT=38100
export E2E_INSPECTOR_BASE_PORT=39100

setsid sleep 30 &
sentinel_pid="$!"
sentinel_group="$(ps -o pgid= -p "$sentinel_pid" | tr -d '[:space:]')"
[[ "$sentinel_group" =~ ^[1-9][0-9]*$ ]] || fail "could not resolve sentinel process group"

bash "$test_dir/fixture/tests/ci/e2e-parallel-local.sh" \
  >"$test_dir/runner.log" 2>&1 &
runner_pid="$!"

for _ in $(seq 1 200); do
  ready=true
  for shard in 1 2 3 4; do
    if [[ ! -s "$test_dir/detached-${shard}.pid" ]]; then
      ready=false
      break
    fi
  done
  if [[ "$ready" == true ]]; then break; fi
  process_is_alive "$runner_pid" || {
    sed -n '1,240p' "$test_dir/runner.log" >&2
    fail "parallel runner exited before all detached descendants started"
  }
  sleep 0.05
done

for shard in 1 2 3 4; do
  detached_pid="$(<"$test_dir/detached-${shard}.pid")"
  process_is_alive "$detached_pid" || fail "detached shard ${shard} process exited early"
done

kill -TERM "$runner_pid"
set +e
wait "$runner_pid"
runner_exit_code="$?"
set -e
[[ "$runner_exit_code" == 130 ]] ||
  fail "parallel runner returned ${runner_exit_code} after interrupt"

for _ in $(seq 1 100); do
  all_stopped=true
  for shard in 1 2 3 4; do
    detached_pid="$(<"$test_dir/detached-${shard}.pid")"
    if process_is_alive "$detached_pid"; then
      all_stopped=false
      break
    fi
  done
  if [[ "$all_stopped" == true ]]; then break; fi
  sleep 0.05
done

for shard in 1 2 3 4; do
  detached_pid="$(<"$test_dir/detached-${shard}.pid")"
  process_is_alive "$detached_pid" || continue
  fail "detached shard ${shard} process ${detached_pid} survived cleanup"
done

process_is_alive "$sentinel_pid" || fail "cleanup killed an unrelated process group"
echo "parallel E2E detached-process cleanup regression passed"
