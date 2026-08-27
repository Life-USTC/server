#!/usr/bin/env bash
# Regression: if the Worker dies after startup while a shard is active, the
# wrapper must preserve the child exit status and the shard runner must retry
# that whole shard exactly once after restoring the CI database baseline.
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

crash_report_dir="${temp_dir}/crash-report"
fake_command_log="${temp_dir}/fake-commands.log"
set +e
CI=true \
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:1/e2e-regression" \
ALLOW_DATABASE_SEED=true \
E2E_BUNX_BIN="${repo_root}/tests/ci/fixtures/e2e-fake-bunx.sh" \
E2E_FAKE_COMMAND_LOG="$fake_command_log" \
E2E_FAKE_SHARD_MODE=worker-crash \
E2E_PORT="$port" \
E2E_REPORT_ROOT="$crash_report_dir" \
  bash tests/ci/e2e-run-shard.sh 1/4 >"${temp_dir}/crash-runner.log" 2>&1
crash_runner_exit_code="$?"
set -e

((crash_runner_exit_code == 0)) ||
  fail "Worker crash shard did not pass on its bounded retry"
test -f "$fake_command_log" || fail "fake command log was not created"
[[ "$(grep -c '^playwright ' "$fake_command_log" || true)" == "2" ]] ||
  fail "Worker crash shard did not execute exactly two Playwright attempts"
[[ "$(grep -c '^prisma migrate reset --force$' "$fake_command_log" || true)" == "1" ]] ||
  fail "CI retry did not reset the database exactly once"
[[ "$(grep -c '^prisma db seed$' "$fake_command_log" || true)" == "1" ]] ||
  fail "CI retry did not reseed the reset database exactly once"
reset_command_line="$(grep -n '^prisma migrate reset --force$' "$fake_command_log" | cut -d: -f1)"
seed_command_line="$(grep -n '^prisma db seed$' "$fake_command_log" | cut -d: -f1)"
second_playwright_line="$(grep -n '^playwright ' "$fake_command_log" | sed -n '2p' | cut -d: -f1)"
((reset_command_line < seed_command_line && seed_command_line < second_playwright_line)) ||
  fail "CI database reset and seed did not finish before the replay attempt"
grep -q 'attempt=1 status=confirmed-worker-failure' \
  "${crash_report_dir}/worker-runner.log" ||
  fail "Worker crash was not classified for retry"
grep -q 'attempt=2 status=passed' "${crash_report_dir}/worker-runner.log" ||
  fail "second shard attempt was not recorded as passed"
[[ "$(grep -c 'status=started' "${crash_report_dir}/worker-runner.log" || true)" == "2" ]] ||
  fail "Worker crash shard did not record exactly two attempts"
if grep -q 'attempt=3' "${crash_report_dir}/worker-runner.log"; then
  fail "Worker crash shard exceeded its one-attempt retry bound"
fi
for attempt in 1 2; do
  attempt_dir="${crash_report_dir}/worker/shard-1/attempt-${attempt}"
  test -s "${attempt_dir}/wrangler.log" ||
    fail "attempt ${attempt} Wrangler log artifact is empty"
  test -s "${attempt_dir}/health.log" ||
    fail "attempt ${attempt} health-check artifact is empty"
done
grep -q '^outcome=worker_crash$' \
  "${crash_report_dir}/worker/shard-1/attempt-1/wrangler.status" ||
  fail "first fake shard attempt did not record worker_crash"
grep -q '^outcome=test_shutdown$' \
  "${crash_report_dir}/worker/shard-1/attempt-2/wrangler.status" ||
  fail "passing fake shard attempt did not shut down its Worker cleanly"

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
