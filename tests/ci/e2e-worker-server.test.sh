#!/usr/bin/env bash
# Regression: if the Worker dies after startup while a shard is active, the
# wrapper must preserve the child exit status and classify the run as a crash.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

fail() {
  echo "e2e Worker server regression test failed: $*" >&2
  exit 1
}

for command in bun curl; do
  command -v "$command" >/dev/null 2>&1 || fail "$command is required"
done

temp_dir="$(mktemp -d)"
cleanup() {
  if [[ -n "${server_pid:-}" ]] && kill -0 "$server_pid" >/dev/null 2>&1; then
    kill -TERM "$server_pid" >/dev/null 2>&1 || true
  fi
  rm -rf "$temp_dir"
}
trap cleanup EXIT

worker_dir="${temp_dir}/worker"
port="$(bun -e '
  const listener = Bun.listen({
    hostname: "127.0.0.1",
    port: 0,
    socket: { data() {} },
  });
  console.log(listener.port);
  listener.stop(true);
')"

E2E_BUNX_BIN="${repo_root}/tests/ci/fixtures/e2e-fake-bunx.sh" \
E2E_PORT="$port" \
E2E_WORKER_ARTIFACT_DIR="$worker_dir" \
  bash tests/ci/e2e-worker-server.sh >"${temp_dir}/wrapper.log" 2>&1 &
server_pid="$!"

for _ in $(seq 1 30); do
  if [[ -f "${worker_dir}/wrangler.pid" ]] &&
    grep -q '^outcome=running$' "${worker_dir}/wrangler.status" 2>/dev/null; then
    break
  fi
  if ! kill -0 "$server_pid" >/dev/null 2>&1; then
    fail "Worker wrapper exited before startup"
  fi
  sleep 1
done

test -f "${worker_dir}/wrangler.pid" || fail "Worker pid was not recorded"
grep -q '^outcome=running$' "${worker_dir}/wrangler.status" ||
  fail "Worker did not pass startup health check"

worker_pid="$(<"${worker_dir}/wrangler.pid")"
kill -TERM "$worker_pid" || fail "could not terminate fake Worker"

set +e
wait "$server_pid"
wrapper_exit_code="$?"
set -e

((wrapper_exit_code != 0)) || fail "Worker termination returned success"
grep -q '^outcome=worker_crash$' "${worker_dir}/wrangler.status" ||
  fail "Worker termination was not classified as worker_crash"
grep -q '^exit_code=' "${worker_dir}/wrangler.status" ||
  fail "Worker exit status was not captured"
test -s "${worker_dir}/wrangler.log" || fail "Wrangler log artifact is empty"
test -s "${worker_dir}/health.log" || fail "health-check log artifact is empty"

deterministic_report_dir="${temp_dir}/deterministic-report"
set +e
E2E_BUNX_BIN="${repo_root}/tests/ci/fixtures/e2e-fake-bunx.sh" \
E2E_REPORT_ROOT="$deterministic_report_dir" \
  bash tests/ci/e2e-run-shard.sh 1/4 >"${temp_dir}/deterministic.log" 2>&1
deterministic_exit_code="$?"
set -e

((deterministic_exit_code != 0)) ||
  fail "deterministic Playwright failure returned success"
grep -q 'attempt=1 status=failed-deterministic' \
  "${deterministic_report_dir}/worker-runner.log" ||
  fail "deterministic Playwright failure was not recorded"
grep -q 'Broken pipe' \
  "${deterministic_report_dir}/worker/shard-1/attempt-1/wrangler.log" ||
  fail "deterministic fixture did not emit the Broken pipe diagnostic"
if grep -q 'attempt=2' "${deterministic_report_dir}/worker-runner.log"; then
  fail "deterministic Playwright failure was retried"
fi

echo "e2e Worker termination regression test passed"
