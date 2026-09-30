#!/usr/bin/env bash
# Execute the requested native partition once. Per-case fixtures own runtime
# startup and cleanup; any failed assertion or runtime failure remains a failure.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

readonly shard="${1:-}"
shift || true
readonly bunx_bin="${E2E_BUNX_BIN:-bunx}"

if [[ ! "$shard" =~ ^[1-9][0-9]*/[1-9][0-9]*$ ]]; then
  echo "E2E shard must use current/total format." >&2
  exit 1
fi
if ((10#${shard%%/*} > 10#${shard##*/})); then
  echo "E2E shard index must not exceed the total." >&2
  exit 1
fi

exec "$bunx_bin" playwright test --shard="$shard" "$@"
