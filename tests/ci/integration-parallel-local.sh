#!/usr/bin/env bash
# Each shard owns a fresh PostgreSQL instance; files within it remain serial.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

shard_total="${INTEGRATION_SHARDS:-4}"
if ! [[ "$shard_total" =~ ^[1-8]$ ]]; then
  echo "INTEGRATION_SHARDS must be an integer from 1 through 8." >&2
  exit 1
fi

# The default local runner is also the convenient way to exercise the role
# contracts. Do not let an explicitly disabled gate turn mandatory tests into
# silent skips.
for role_test_flag in \
  RLS_TEST_ENABLED \
  AUTH_ROLE_TEST_ENABLED \
  FUNCTION_OWNER_ROLE_TEST_ENABLED \
  MAINTENANCE_ROLE_TEST_ENABLED; do
  if [[ -v "$role_test_flag" && "${!role_test_flag}" != "true" ]]; then
    echo "$role_test_flag must be true for the parallel integration runner." >&2
    exit 1
  fi
  export "$role_test_flag=true"
done

for command in docker bun bunx psql setsid; do
  command -v "$command" >/dev/null || { echo "$command is required." >&2; exit 1; }
done

report_root="${INTEGRATION_REPORT_ROOT:-$(mktemp -d -t life-ustc-integration.XXXXXX)}"
mkdir -p "$report_root"
echo "Integration reports: $report_root"
container_prefix="life-ustc-integration-$$"
pids=()
containers=()
database_urls=()
cleanup() {
  trap '' INT TERM
  local has_live_process=false
  for pid in "${pids[@]}"; do
    if kill -0 -- "-${pid}" >/dev/null 2>&1; then
      kill -TERM -- "-${pid}" >/dev/null 2>&1 || true
      has_live_process=true
    fi
  done
  if [[ "$has_live_process" == true ]]; then
    sleep 1
    for pid in "${pids[@]}"; do
      kill -KILL -- "-${pid}" >/dev/null 2>&1 || true
    done
  fi
  for pid in "${pids[@]}"; do
    wait "$pid" 2>/dev/null || true
  done
  for container in "${containers[@]}"; do
    docker rm -f -v "$container" >/dev/null 2>&1 || true
  done
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

for shard in $(seq 1 "$shard_total"); do
  container="${container_prefix}-${shard}"
  containers+=("$container")
  docker run --detach --rm --name "$container" \
    --env POSTGRES_DB=life_ustc_integration \
    --env POSTGRES_USER=postgres --env POSTGRES_PASSWORD=postgres \
    --publish 127.0.0.1::5432 postgres:16 >/dev/null
  for attempt in $(seq 1 60); do
    if docker exec "$container" pg_isready -U postgres -d life_ustc_integration >/dev/null 2>&1; then
      break
    fi
    if ((attempt == 60)); then
      echo "PostgreSQL for shard $shard did not become ready." >&2
      exit 1
    fi
    sleep 1
  done
  port="$(docker port "$container" 5432/tcp | sed -E 's/.*:([0-9]+)$/\1/')"
  database_urls+=("postgresql://postgres:postgres@127.0.0.1:${port}/life_ustc_integration")
done

DATABASE_URL="${database_urls[0]}" bun run app:prepare >"$report_root/prepare.log" 2>&1
export AUTH_SECRET="${AUTH_SECRET:-e2e-dev-secret-not-for-production}"
for shard in $(seq 1 "$shard_total"); do
  setsid bash tests/ci/integration-local-shard.sh "$shard" "$shard_total" \
    "${database_urls[$((shard - 1))]}" "$@" >"$report_root/shard-${shard}.log" 2>&1 &
  pids+=("$!")
done

failed_shards=()
for shard in $(seq 1 "$shard_total"); do
  if ! wait "${pids[$((shard - 1))]}"; then
    failed_shards+=("$shard")
    cat "$report_root/shard-${shard}.log"
  else
    tail -n 8 "$report_root/shard-${shard}.log"
  fi
done
if ((${#failed_shards[@]})); then
  echo "Integration shards failed: ${failed_shards[*]}. Logs: $report_root" >&2
  exit 1
fi
echo "All $shard_total isolated integration shards passed. Logs: $report_root"
