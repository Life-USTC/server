#!/usr/bin/env bash
# Run one Playwright shard and retry only a confirmed Worker startup/crash
# failure. Playwright itself must not retry individual tests: an assertion
# failure is deterministic evidence against the application or test.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

readonly shard="${1:-}"
shift || true
readonly e2e_infra_retry_attempts=2
readonly report_root="${E2E_REPORT_ROOT:-playwright-report}"
readonly worker_artifact_root="${E2E_WORKER_ARTIFACT_ROOT:-${report_root}/worker}"
readonly runner_log="${report_root}/worker-runner.log"
readonly bunx_bin="${E2E_BUNX_BIN:-bunx}"

if [[ ! "$shard" =~ ^[1-9][0-9]*/[1-9][0-9]*$ ]]; then
  echo "E2E shard must use current/total format." >&2
  exit 1
fi

readonly shard_number="${shard%%/*}"
mkdir -p "$worker_artifact_root"
printf '%s shard=%s max_attempts=%s\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$shard" "$e2e_infra_retry_attempts" >>"$runner_log"

worker_failure_is_confirmed() {
  local status_file="$1"
  [[ -f "$status_file" ]] || return 1

  # The status is written by e2e-worker-server.sh only after a process exit or
  # the bounded health-failure threshold. Do not classify log text (including
  # Wrangler's harmless Broken pipe diagnostic) as a retryable failure.
  grep -Eq '^outcome=(startup_failure|worker_crash|health_failure)$' "$status_file"
}

reset_database_for_retry() {
  # seed.sql intentionally preserves unrelated local rows and uses
  # conflict-tolerant inserts. That makes it safe to run repeatedly, but not
  # a complete reset after a shard has mutated its fixtures. CI owns a fresh
  # database service, so recreate that database before the whole-shard replay;
  # explicitly run the configured seed after the reset. Never drop a
  # developer's local database just because a local shard failed.
  if [[ "${CI:-}" == "true" || "${CI:-}" == "1" ]]; then
    echo "Resetting the CI E2E database before replaying shard ${shard}." >&2
    ALLOW_DATABASE_SEED=true "$bunx_bin" prisma migrate reset --force
    ALLOW_DATABASE_SEED=true "$bunx_bin" prisma db seed
  else
    bun run db:migrate:deploy
    "$bunx_bin" prisma db seed
  fi
}

for attempt in $(seq 1 "$e2e_infra_retry_attempts"); do
  attempt_artifact_dir="${worker_artifact_root}/shard-${shard_number}/attempt-${attempt}"
  export E2E_WORKER_ARTIFACT_DIR="$attempt_artifact_dir"
  export E2E_TEST_ATTEMPT="$attempt"
  mkdir -p "$attempt_artifact_dir"

  printf '%s attempt=%s status=started\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$attempt" >>"$runner_log"

  playwright_exit_code=0
  set +e
  "$bunx_bin" playwright test --shard="$shard" "$@"
  playwright_exit_code="$?"
  set -e

  status_file="${attempt_artifact_dir}/wrangler.status"
  if ((playwright_exit_code == 0)); then
    printf '%s attempt=%s status=passed\n' \
      "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$attempt" >>"$runner_log"
    exit 0
  fi

  if ! worker_failure_is_confirmed "$status_file"; then
    printf '%s attempt=%s status=failed-deterministic exit_code=%s\n' \
      "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$attempt" "$playwright_exit_code" >>"$runner_log"
    exit "$playwright_exit_code"
  fi

  printf '%s attempt=%s status=confirmed-worker-failure exit_code=%s\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$attempt" "$playwright_exit_code" >>"$runner_log"
  if ((attempt == e2e_infra_retry_attempts)); then
    echo "E2E shard ${shard} failed after ${attempt} attempts due to a confirmed Worker failure." >&2
    exit "$playwright_exit_code"
  fi

  echo "E2E shard ${shard} hit a confirmed Worker failure; reseeding before retry ${attempt}/${e2e_infra_retry_attempts}." >&2
  reset_database_for_retry
done
