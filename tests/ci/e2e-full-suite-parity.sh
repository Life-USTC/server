#!/usr/bin/env bash
# Run the complete E2E suite with the same per-shard database lifecycle as CI.
#
# CI runs four independent jobs. Each job migrates, seeds, and executes one
# Playwright shard against a fresh database. A single unsharded `playwright test`
# invocation reuses one seed across all files and projects, so shared-state
# mutations from earlier shards leak into later ones.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

readonly E2E_SHARD_TOTAL=4

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL must be set for E2E database lifecycle." >&2
  exit 1
fi

if [[ "${ALLOW_DATABASE_SEED:-}" != "true" ]]; then
  echo "Set ALLOW_DATABASE_SEED=true before reseeding for each shard." >&2
  exit 1
fi

bun run app:prepare
bun run build

failed_shards=()

for shard in $(seq 1 "$E2E_SHARD_TOTAL"); do
  echo "=== E2E shard ${shard}/${E2E_SHARD_TOTAL} ==="
  bun run app:prepare
  bun run db:migrate:deploy
  bunx prisma db seed
  if ! bunx playwright test --shard="${shard}/${E2E_SHARD_TOTAL}"; then
    failed_shards+=("${shard}/${E2E_SHARD_TOTAL}")
  fi
done

if ((${#failed_shards[@]} > 0)); then
  echo "E2E full-suite parity failed for shard(s): ${failed_shards[*]}" >&2
  exit 1
fi

echo "E2E full-suite parity passed for all ${E2E_SHARD_TOTAL} shards."
