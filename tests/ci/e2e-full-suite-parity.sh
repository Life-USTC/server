#!/usr/bin/env bash
# Run the complete browser suite with the same 24 native partitions as CI.
# Prepare schema and roles once; every case arranges its own empty database clone.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

readonly E2E_SHARD_TOTAL=24

if [[ -z "${FUNCTION_OWNER_DATABASE_URL:-}" ]]; then
  echo "FUNCTION_OWNER_DATABASE_URL must be set for E2E database lifecycle." >&2
  exit 1
fi

if [[ "${ALLOW_TEST_DATABASE_SETUP:-}" != "true" ]]; then
  echo "Set ALLOW_TEST_DATABASE_SETUP=true before preparing the disposable test schema." >&2
  exit 1
fi

DATABASE_URL="$FUNCTION_OWNER_DATABASE_URL" bun run build

source tests/ci/setup-runtime-database.sh

failed_shards=()

for shard in $(seq 1 "$E2E_SHARD_TOTAL"); do
  echo "=== E2E shard ${shard}/${E2E_SHARD_TOTAL} ==="
  if ! bash tests/ci/e2e-run-shard.sh "${shard}/${E2E_SHARD_TOTAL}"; then
    failed_shards+=("${shard}/${E2E_SHARD_TOTAL}")
  fi
done

if ((${#failed_shards[@]} > 0)); then
  echo "E2E full-suite parity failed for shard(s): ${failed_shards[*]}" >&2
  exit 1
fi

echo "E2E full-suite parity passed for all ${E2E_SHARD_TOTAL} shards."
