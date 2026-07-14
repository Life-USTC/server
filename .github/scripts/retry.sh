#!/usr/bin/env bash

retry_command() {
  local max_attempts="$1"
  local delay_seconds="$2"
  local label="$3"
  local cleanup_command="$4"
  shift 4

  local attempt
  for ((attempt = 1; attempt <= max_attempts; attempt++)); do
    if "$@"; then
      return 0
    fi
    if ((attempt == max_attempts)); then
      echo "::error::${label} failed after ${attempt} attempts."
      return 1
    fi
    echo "::warning::${label} failed (attempt ${attempt}/${max_attempts}), retrying..."
    "$cleanup_command"
    sleep "$delay_seconds"
  done
}
