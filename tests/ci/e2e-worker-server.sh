#!/usr/bin/env bash
# Start the local Wrangler Worker, expose a liveness check, and retain enough
# process state to distinguish a Worker crash from a failing Playwright test.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

readonly worker_port="${E2E_PORT:-3000}"
readonly worker_artifact_dir="${E2E_WORKER_ARTIFACT_DIR:-${E2E_REPORT_ROOT:-playwright-report}/worker}"
readonly worker_log="${worker_artifact_dir}/wrangler.log"
readonly worker_status="${worker_artifact_dir}/wrangler.status"
readonly worker_health_log="${worker_artifact_dir}/health.log"
readonly worker_pid_file="${worker_artifact_dir}/wrangler.pid"
readonly worker_health_failure="${worker_artifact_dir}/health.failure"
readonly worker_config="${E2E_WRANGLER_CONFIG:-wrangler.e2e.jsonc}"
readonly worker_health_url="${E2E_WORKER_HEALTH_URL:-http://127.0.0.1:${worker_port}/api/health}"
readonly worker_origin="${E2E_APP_PUBLIC_ORIGIN:-http://localhost:${worker_port}}"
readonly worker_startup_timeout_seconds=300
readonly worker_health_interval_seconds=2
readonly worker_health_failure_threshold=3
readonly bunx_bin="${E2E_BUNX_BIN:-bunx}"

if ! [[ "$worker_port" =~ ^[0-9]+$ ]]; then
  echo "E2E_PORT must be a numeric TCP port." >&2
  exit 1
fi

mkdir -p "$worker_artifact_dir"
: >"$worker_log"
: >"$worker_health_log"
rm -f "$worker_status" "$worker_pid_file" "$worker_health_failure"

worker_pid=""
health_monitor_pid=""
shutdown_requested=false

write_status() {
  local outcome="$1"
  local exit_code="$2"
  local detail="$3"
  local temporary_status="${worker_status}.tmp"

  {
    printf 'outcome=%s\n' "$outcome"
    printf 'exit_code=%s\n' "$exit_code"
    printf 'detail=%s\n' "$detail"
    printf 'health_url=%s\n' "$worker_health_url"
    printf 'pid=%s\n' "${worker_pid:-unknown}"
    printf 'worker_pid=%s\n' "${worker_pid:-unknown}"
    printf 'worker_exit_code=%s\n' "$exit_code"
    printf 'finished_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  } >"$temporary_status"
  mv -f "$temporary_status" "$worker_status"
}

timestamp() {
  date -u +%Y-%m-%dT%H:%M:%SZ
}

health_check() {
  local response
  response="$(curl --silent --show-error --fail --max-time 2 --noproxy '*' "$worker_health_url" 2>/dev/null)" ||
    return 1
  [[ "$response" == "ok" ]]
}

log_health() {
  printf '%s status=%s consecutive_failures=%s\n' "$(timestamp)" "$1" "$2" >>"$worker_health_log"
}

stop_health_monitor() {
  if [[ -n "$health_monitor_pid" ]] && kill -0 "$health_monitor_pid" >/dev/null 2>&1; then
    kill -TERM "$health_monitor_pid" >/dev/null 2>&1 || true
  fi
  if [[ -n "$health_monitor_pid" ]]; then
    wait "$health_monitor_pid" >/dev/null 2>&1 || true
  fi
  health_monitor_pid=""
}

request_worker_shutdown() {
  shutdown_requested=true
  # Playwright may terminate the webServer process tree while the child is
  # still unwinding. Record the expected teardown immediately so a forced
  # process-tree kill cannot leave an ambiguous `running` artifact.
  write_status "test_shutdown" 143 "Playwright requested Worker shutdown"
  if [[ -n "$worker_pid" ]] && kill -0 "$worker_pid" >/dev/null 2>&1; then
    kill -TERM "$worker_pid" >/dev/null 2>&1 || true
  fi
}

worker_is_running() {
  [[ -n "$worker_pid" ]] || return 1
  kill -0 "$worker_pid" >/dev/null 2>&1 || return 1

  local process_state
  process_state="$(ps -o stat= -p "$worker_pid" 2>/dev/null | tr -d '[:space:]')"
  [[ -n "$process_state" && "$process_state" != Z* ]]
}

trap request_worker_shutdown INT TERM

if ! command -v curl >/dev/null 2>&1; then
  write_status "startup_failure" 127 "curl is required for Worker health checks"
  echo "curl is required for Worker health checks." >&2
  exit 1
fi

wrangler_args=(
  wrangler
  dev
  --config
  "$worker_config"
  --ip
  127.0.0.1
  --port
  "$worker_port"
  --local
  --var
  "APP_PUBLIC_ORIGIN:${worker_origin}"
)
if [[ -n "${E2E_PERSIST_TO:-}" ]]; then
  wrangler_args+=("--persist-to=${E2E_PERSIST_TO}")
fi
if [[ -n "${E2E_INSPECTOR_PORT:-}" ]]; then
  wrangler_args+=(--inspector-port "$E2E_INSPECTOR_PORT")
fi

printf '%s command=%q' "$(timestamp)" "$bunx_bin" >>"$worker_log"
for argument in "${wrangler_args[@]}"; do
  printf ' %q' "$argument" >>"$worker_log"
done
printf '\n' >>"$worker_log"

"$bunx_bin" "${wrangler_args[@]}" >>"$worker_log" 2>&1 &
worker_pid="$!"
printf '%s\n' "$worker_pid" >"$worker_pid_file"

startup_ready=false
for startup_attempt in $(seq 1 "$worker_startup_timeout_seconds"); do
  if health_check; then
    startup_ready=true
    log_health "ok" 0
    break
  fi

  log_health "starting" "$startup_attempt"
  if ! worker_is_running; then
    worker_exit_code=0
    set +e
    wait "$worker_pid"
    worker_exit_code="$?"
    set -e
    write_status "startup_failure" "$worker_exit_code" "Worker exited before /api/health became ready"
    echo "Worker exited before /api/health became ready; see ${worker_log}." >&2
    exit 1
  fi
  sleep 1
done

if [[ "$startup_ready" != "true" ]]; then
  request_worker_shutdown
  worker_exit_code=0
  set +e
  wait "$worker_pid"
  worker_exit_code="$?"
  set -e
  write_status "startup_failure" "$worker_exit_code" "Worker did not pass /api/health within ${worker_startup_timeout_seconds}s"
  echo "Worker did not pass /api/health within ${worker_startup_timeout_seconds}s; see ${worker_log}." >&2
  exit 1
fi

write_status "running" 0 "Worker passed the startup health check"

health_monitor() {
  trap - INT TERM
  local consecutive_failures=0
  while worker_is_running; do
    if health_check; then
      consecutive_failures=0
      log_health "ok" 0
    else
      consecutive_failures=$((consecutive_failures + 1))
      log_health "failed" "$consecutive_failures"
      if ((consecutive_failures >= worker_health_failure_threshold)); then
        : >"$worker_health_failure"
      fi
    fi
    sleep "$worker_health_interval_seconds"
  done
}

health_monitor &
health_monitor_pid="$!"

worker_exit_code=0
set +e
wait "$worker_pid"
worker_exit_code="$?"
set -e

# Playwright sends TERM to the webServer process after the shard has finished.
# A clean teardown is not a Worker crash, even though Wrangler returns 143.
if [[ "$shutdown_requested" == "true" ]]; then
  stop_health_monitor
  if [[ -e "$worker_health_failure" ]]; then
    write_status "health_failure" "$worker_exit_code" "Worker health checks failed during the shard"
  else
    write_status "test_shutdown" "$worker_exit_code" "Playwright stopped the Worker after the shard"
  fi
  exit 0
fi

stop_health_monitor
if [[ -e "$worker_health_failure" ]]; then
  write_status "worker_crash" "$worker_exit_code" "Worker exited after health failures during the shard"
else
  write_status "worker_crash" "$worker_exit_code" "Worker exited while the shard was running"
fi
echo "Wrangler Worker exited with status ${worker_exit_code}; see ${worker_log}." >&2
exit 1
