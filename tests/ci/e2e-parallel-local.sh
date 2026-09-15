#!/usr/bin/env bash
# Run the four Playwright shards concurrently against isolated local services.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

readonly shard_total=4
readonly base_port="${E2E_BASE_PORT:-3100}"
readonly inspector_base_port="${E2E_INSPECTOR_BASE_PORT:-3200}"
readonly run_id="$$"
readonly container_prefix="life-ustc-e2e-${run_id}"
temp_dir="$(mktemp -d)"
pids=()
detached_group_ids=()
detached_group_members=()
main_process_group=""

if ! [[ "$base_port" =~ ^[0-9]+$ ]] || ((base_port < 1024 || base_port > 65531)); then
  echo "E2E_BASE_PORT must be an integer from 1024 through 65531." >&2
  exit 1
fi
if ! [[ "$inspector_base_port" =~ ^[0-9]+$ ]] ||
  ((inspector_base_port < 1024 || inspector_base_port > 65531)); then
  echo "E2E_INSPECTOR_BASE_PORT must be an integer from 1024 through 65531." >&2
  exit 1
fi

for command in docker bun psql setsid ps pgrep; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "$command is required for parallel E2E tests." >&2
    exit 1
  fi
done

process_group_for_pid() {
  ps -o pgid= -p "$1" 2>/dev/null | tr -d '[:space:]' || true
}

process_is_alive() {
  local pid="$1"
  kill -0 "$pid" >/dev/null 2>&1 || return 1

  local process_state
  process_state="$(ps -o stat= -p "$pid" 2>/dev/null | tr -d '[:space:]' || true)"
  [[ -n "$process_state" && "$process_state" != Z* ]]
}

remember_detached_group() {
  local pid="$1"
  local group="$2"

  [[ "$group" =~ ^[1-9][0-9]*$ ]] || return 0
  ((group > 1)) || return 0
  [[ "$group" != "$main_process_group" ]] || return 0

  local index
  for index in "${!detached_group_ids[@]}"; do
    if [[ "${detached_group_ids[$index]}" == "$group" ]]; then
      detached_group_members[$index]="${detached_group_members[$index]} $pid"
      return 0
    fi
  done

  detached_group_ids+=("$group")
  detached_group_members+=("$pid")
}

snapshot_descendant_groups() {
  local parent_pid="$1"
  local root_group="$2"
  local child_pid
  local child_group

  while IFS= read -r child_pid; do
    [[ "$child_pid" =~ ^[1-9][0-9]*$ ]] || continue
    child_group="$(process_group_for_pid "$child_pid")"
    if [[ "$child_group" =~ ^[1-9][0-9]*$ ]] &&
      [[ "$child_group" != "$root_group" ]]; then
      remember_detached_group "$child_pid" "$child_group"
    fi
    snapshot_descendant_groups "$child_pid" "$root_group"
  done < <(pgrep -P "$parent_pid" 2>/dev/null || true)
}

detached_group_is_alive() {
  local index="$1"
  local group="${detached_group_ids[$index]}"
  local member_pid

  for member_pid in ${detached_group_members[$index]}; do
    if process_is_alive "$member_pid" &&
      [[ "$(process_group_for_pid "$member_pid")" == "$group" ]]; then
      return 0
    fi
  done
  return 1
}

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

cleanup() {
  trap '' INT TERM
  local has_live_process=false
  local root_group
  local index

  # Playwright can detach its webServer process group from the shard. Capture
  # those groups while the shard roots still own them, before sending TERM.
  detached_group_ids=()
  detached_group_members=()
  main_process_group="$(process_group_for_pid "$$")"
  for pid in "${pids[@]}"; do
    if process_is_alive "$pid"; then
      root_group="$(process_group_for_pid "$pid")"
      if [[ "$root_group" =~ ^[1-9][0-9]*$ ]]; then
        snapshot_descendant_groups "$pid" "$root_group"
      fi
    fi
  done

  for pid in "${pids[@]}"; do
    if kill -0 -- "-${pid}" >/dev/null 2>&1; then
      kill -TERM -- "-${pid}" >/dev/null 2>&1 || true
      has_live_process=true
    fi
  done

  for index in "${!detached_group_ids[@]}"; do
    if detached_group_is_alive "$index"; then
      kill -TERM -- "-${detached_group_ids[$index]}" >/dev/null 2>&1 || true
      has_live_process=true
    fi
  done

  if [[ "$has_live_process" == "true" ]]; then
    sleep 1
    for pid in "${pids[@]}"; do
      kill -KILL -- "-${pid}" >/dev/null 2>&1 || true
    done
    for index in "${!detached_group_ids[@]}"; do
      if detached_group_is_alive "$index"; then
        kill -KILL -- "-${detached_group_ids[$index]}" >/dev/null 2>&1 || true
      fi
    done
  fi
  for shard in $(seq 1 "$shard_total"); do
    docker rm -f "${container_prefix}-${shard}" >/dev/null 2>&1 || true
  done
  rm -rf "$temp_dir"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

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

for shard in $(seq 1 "$shard_total"); do
  database_url="${database_urls[$((shard - 1))]}"
  worker_port="$((base_port + shard - 1))"
  log_file="${temp_dir}/shard-${shard}.log"

  setsid bash tests/ci/e2e-local-shard.sh \
    "$shard" \
    "$shard_total" \
    "$database_url" \
    "$worker_port" \
    "$((inspector_base_port + shard - 1))" \
    "$temp_dir" \
    "$@" >"$log_file" 2>&1 &
  pids+=("$!")
done

failed_shards=()
for shard in $(seq 1 "$shard_total"); do
  if ! wait "${pids[$((shard - 1))]}"; then
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
