#!/usr/bin/env bash
# Run the eight Playwright shards against isolated local services with bounded
# local concurrency.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

readonly shard_total=8
readonly e2e_concurrency="${E2E_CONCURRENCY:-2}"
readonly base_port="${E2E_BASE_PORT:-3100}"
readonly inspector_base_port="${E2E_INSPECTOR_BASE_PORT:-3200}"
readonly run_id="$$-$(date +%s%N)"
readonly process_owner_prefix="life-ustc-e2e-${run_id}"
readonly container_prefix="${process_owner_prefix}"
temp_dir=""
shard_process_owners=()

source tests/ci/e2e-process-groups.sh

if ! [[ "$e2e_concurrency" =~ ^[1-8]$ ]]; then
  echo "E2E_CONCURRENCY must be an integer from 1 through 8." >&2
  exit 1
fi

readonly max_shard_port=$((65535 - shard_total + 1))

if ! [[ "$base_port" =~ ^[0-9]+$ ]] ||
  ((base_port < 1024 || base_port > max_shard_port)); then
  echo "E2E_BASE_PORT must be an integer from 1024 through ${max_shard_port}." >&2
  exit 1
fi
if ! [[ "$inspector_base_port" =~ ^[0-9]+$ ]] ||
  ((inspector_base_port < 1024 || inspector_base_port > max_shard_port)); then
  echo "E2E_INSPECTOR_BASE_PORT must be an integer from 1024 through ${max_shard_port}." >&2
  exit 1
fi
if ((base_port <= inspector_base_port + shard_total - 1)) &&
  ((inspector_base_port <= base_port + shard_total - 1)); then
  echo "E2E worker and inspector port ranges must not overlap." >&2
  exit 1
fi

for command in docker bun psql setsid ps; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "$command is required for parallel E2E tests." >&2
    exit 1
  fi
done

assert_port_available() {
  local port="$1"
  if ! bun -e '
    const port = Number(process.argv.at(-1));
    const listener = Bun.listen({
      hostname: "127.0.0.1",
      port,
      socket: { data() {} },
    });
    listener.stop(true);
  ' "$port" >/dev/null 2>&1; then
    echo "TCP port ${port} is already in use; override the E2E port range." >&2
    exit 1
  fi
}

for shard in $(seq 1 "$shard_total"); do
  assert_port_available "$((base_port + shard - 1))"
  assert_port_available "$((inspector_base_port + shard - 1))"
done

cleanup_shard_processes() {
  local owner="$1"
  local main_process_group

  main_process_group="$(e2e_process_group_for_pid "$$")"
  if e2e_signal_owned_processes "$owner" TERM "$$" "$main_process_group"; then
    sleep 1
    e2e_signal_owned_processes "$owner" KILL "$$" "$main_process_group" || true
  fi
}

cleanup() {
  trap '' INT TERM
  local has_live_process=false
  local main_process_group
  local owner

  main_process_group="$(e2e_process_group_for_pid "$$")"

  for owner in "${shard_process_owners[@]}"; do
    if e2e_signal_owned_processes "$owner" TERM "$$" "$main_process_group"; then
      has_live_process=true
    fi
  done

  if [[ "$has_live_process" == "true" ]]; then
    sleep 1
    for owner in "${shard_process_owners[@]}"; do
      e2e_signal_owned_processes "$owner" KILL "$$" "$main_process_group" || true
    done
  fi
  for shard in $(seq 1 "$shard_total"); do
    docker rm -f "${container_prefix}-${shard}" >/dev/null 2>&1 || true
  done
  rm -rf "$temp_dir"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

temp_dir="$(mktemp -d)"

database_urls=()
for shard in $(seq 1 "$shard_total"); do
  container="${container_prefix}-${shard}"
  docker run --detach --rm \
    --name "$container" \
    --env POSTGRES_DB=life_ustc_dev \
    --env POSTGRES_USER=postgres \
    --env POSTGRES_PASSWORD=postgres \
    --publish 127.0.0.1::5432 \
    postgres:16 >/dev/null

  for attempt in $(seq 1 60); do
    if docker exec "$container" pg_isready \
      --username postgres --dbname life_ustc_dev >/dev/null 2>&1; then
      break
    fi
    if ((attempt == 60)); then
      echo "PostgreSQL for shard ${shard}/${shard_total} did not become ready." >&2
      exit 1
    fi
    sleep 1
  done

  database_port="$(docker port "$container" 5432/tcp | sed -E 's/.*:([0-9]+)$/\1/')"
  database_urls+=("postgresql://postgres:postgres@127.0.0.1:${database_port}/life_ustc_dev")
done

DATABASE_URL="${database_urls[0]}" bun run app:prepare
DATABASE_URL="${database_urls[0]}" bun run build

failed_shards=()
active_pids=()
declare -A shard_for_pid=()
next_shard=1

while ((next_shard <= shard_total || ${#active_pids[@]} > 0)); do
  while ((next_shard <= shard_total && ${#active_pids[@]} < e2e_concurrency)); do
    shard="$next_shard"
    database_url="${database_urls[$((shard - 1))]}"
    worker_port="$((base_port + shard - 1))"
    log_file="${temp_dir}/shard-${shard}.log"
    process_owner="${process_owner_prefix}-shard-${shard}"
    shard_process_owners+=("$process_owner")

    E2E_PROCESS_OWNER="$process_owner" setsid bash tests/ci/e2e-local-shard.sh \
      "$shard" \
      "$shard_total" \
      "$database_url" \
      "$worker_port" \
      "$((inspector_base_port + shard - 1))" \
      "$temp_dir" \
      "$@" >"$log_file" 2>&1 &
    pid="$!"
    active_pids+=("$pid")
    shard_for_pid[$pid]="$shard"
    ((next_shard++))
  done

  finished_pid=""
  wait_result=0
  set +e
  wait -n -p finished_pid "${active_pids[@]}"
  wait_result="$?"
  set -e

  shard="${shard_for_pid[$finished_pid]}"
  remaining_pids=()
  for pid in "${active_pids[@]}"; do
    [[ "$pid" == "$finished_pid" ]] || remaining_pids+=("$pid")
  done
  active_pids=("${remaining_pids[@]}")

  cleanup_shard_processes "${process_owner_prefix}-shard-${shard}"

  if ((wait_result != 0)); then
    failed_shards+=("${shard}/${shard_total}")
    echo "=== E2E shard ${shard}/${shard_total} (failed) ==="
    sed -n '1,$p' "${temp_dir}/shard-${shard}.log"
  else
    echo "=== E2E shard ${shard}/${shard_total} (passed) ==="
    tail -n 25 "${temp_dir}/shard-${shard}.log"
  fi
done

if ((${#failed_shards[@]} > 0)); then
  echo "Parallel E2E failed for shard(s): ${failed_shards[*]}" >&2
  exit 1
fi

echo "Parallel E2E passed for all ${shard_total} isolated shards."
