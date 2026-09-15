#!/usr/bin/env bash

# Process ownership helpers for the local E2E runners. Every shard receives a
# unique E2E_PROCESS_OWNER marker; descendants keep it even when they detach
# from the shard's process group and are reparented to init.

e2e_process_group_for_pid() {
  local pid="$1"
  ps -o pgid= -p "$pid" 2>/dev/null | tr -d '[:space:]' || true
}

e2e_process_start_time() {
  local pid="$1"
  [[ -r "/proc/${pid}/stat" ]] || return 1
  local stat_line
  local -a stat_fields
  stat_line="$(<"/proc/${pid}/stat")" || return 1
  # The comm field is parenthesized and may contain spaces. Once the final
  # `) ` delimiter is removed, starttime is field 20 of the remaining data
  # (field 22 in the original /proc/stat record).
  stat_line="${stat_line##*) }"
  read -r -a stat_fields <<<"$stat_line"
  [[ "${#stat_fields[@]}" -ge 20 ]] || return 1
  printf '%s\n' "${stat_fields[19]}"
}

e2e_process_is_alive() {
  local pid="$1"
  kill -0 "$pid" >/dev/null 2>&1 || return 1

  local process_state
  process_state="$(ps -o stat= -p "$pid" 2>/dev/null | tr -d '[:space:]' || true)"
  [[ -n "$process_state" && "$process_state" != Z* ]]
}

e2e_list_owned_processes() {
  local owner="$1"
  local environ_file
  local pid
  local start_time
  local process_group

  while IFS= read -r -d '' environ_file; do
    pid="${environ_file#/proc/}"
    pid="${pid%/environ}"
    # The process may have exited and its PID may have been reused after the
    # batch grep. Re-check the exact marker before reading identity fields.
    grep -aFzxq -- "E2E_PROCESS_OWNER=${owner}" \
      "/proc/${pid}/environ" 2>/dev/null || continue
    start_time="$(e2e_process_start_time "$pid" 2>/dev/null || true)"
    grep -aFzxq -- "E2E_PROCESS_OWNER=${owner}" \
      "/proc/${pid}/environ" 2>/dev/null || continue
    process_group="$(e2e_process_group_for_pid "$pid")"
    [[ "$pid" =~ ^[1-9][0-9]*$ ]] || continue
    [[ "$start_time" =~ ^[1-9][0-9]*$ ]] || continue
    [[ "$process_group" =~ ^[1-9][0-9]*$ ]] || continue
    printf '%s %s %s\n' "$pid" "$start_time" "$process_group"
  done < <(
    grep -aFlZzx -- "E2E_PROCESS_OWNER=${owner}" /proc/[0-9]*/environ \
      2>/dev/null || true
  )
}

# Signal all processes carrying one exact run marker. A recorded /proc start
# time prevents a PID reused between the scan and signal from being touched.
# Process groups are used for isolated shard groups; members in the protected
# caller group are signaled individually so the caller and its siblings remain
# untouched.
e2e_signal_owned_processes() {
  local owner="$1"
  local signal_name="$2"
  local protected_pid="${3:-}"
  local protected_group="${4:-}"
  local found=false
  local pid
  local expected_start_time
  local process_group
  local current_start_time
  local current_process_group
  declare -A signaled_groups=()

  while read -r pid expected_start_time process_group; do
    [[ "$pid" =~ ^[1-9][0-9]*$ ]] || continue
    [[ "$expected_start_time" =~ ^[1-9][0-9]*$ ]] || continue
    [[ "$process_group" =~ ^[1-9][0-9]*$ ]] || continue
    [[ "$pid" != "$protected_pid" ]] || continue

    current_start_time="$(e2e_process_start_time "$pid" 2>/dev/null || true)"
    [[ "$current_start_time" == "$expected_start_time" ]] || continue
    current_process_group="$(e2e_process_group_for_pid "$pid")"
    [[ "$current_process_group" == "$process_group" ]] || continue

    found=true
    if ((process_group > 1)) && [[ "$process_group" != "$protected_group" ]]; then
      if [[ -z "${signaled_groups[$process_group]+present}" ]]; then
        kill -"$signal_name" -- "-${process_group}" >/dev/null 2>&1 || true
        signaled_groups[$process_group]=present
      fi
    else
      kill -"$signal_name" "$pid" >/dev/null 2>&1 || true
    fi
  done < <(e2e_list_owned_processes "$owner")

  [[ "$found" == true ]]
}
