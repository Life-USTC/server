#!/usr/bin/env bash
# Own one disposable PostgreSQL service while Playwright schedules isolated cases.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

for command in docker bun bunx psql setsid ps; do
  command -v "$command" >/dev/null || { echo "$command is required." >&2; exit 1; }
done

readonly process_owner="life-ustc-e2e-$$-$(date +%s%N)"
readonly container="$process_owner"
runner_pid=""
source tests/ci/e2e-process-groups.sh

cleanup() {
  trap '' INT TERM
  local main_process_group
  main_process_group="$(e2e_process_group_for_pid "$$")"
  # Workerd descendants can detach from Playwright's process group.
  if e2e_signal_owned_processes "$process_owner" TERM "$$" "$main_process_group"; then
    sleep 1
    e2e_signal_owned_processes "$process_owner" KILL "$$" "$main_process_group" || true
  fi
  if [[ -n "$runner_pid" ]]; then
    wait "$runner_pid" 2>/dev/null || true
  fi
  docker rm -f "$container" >/dev/null 2>&1 || true
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# The build needs a datasource URL, but does not connect to a database.
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/life_ustc_dev bun run build

docker run --detach --rm --name "$container" \
  --env POSTGRES_DB=life_ustc_dev \
  --env POSTGRES_USER=postgres \
  --env POSTGRES_PASSWORD=postgres \
  --publish 127.0.0.1::5432 postgres:16 >/dev/null
for attempt in $(seq 1 60); do
  if docker exec "$container" pg_isready \
    --username postgres --dbname life_ustc_dev >/dev/null 2>&1; then
    break
  fi
  if ((attempt == 60)); then
    echo "PostgreSQL did not become ready." >&2
    exit 1
  fi
  sleep 1
done
port="$(docker port "$container" 5432/tcp | sed -E 's/.*:([0-9]+)$/\1/')"
export FUNCTION_OWNER_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:${port}/life_ustc_dev"
export ALLOW_TEST_DATABASE_SETUP=true

# Preserve the native exit status and arguments, including --workers and filters.
E2E_PROCESS_OWNER="$process_owner" setsid bash -euo pipefail -c '
  source tests/ci/setup-runtime-database.sh
  exec bunx playwright test "$@"
' _ "$@" &
runner_pid="$!"
wait "$runner_pid"
