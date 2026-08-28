#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

if [ "${VISUAL_REGRESSION:-}" != "1" ]; then
  echo "Skipping visual regression (set VISUAL_REGRESSION=1 to enable)."
  exit 0
fi

test -f .svelte-kit/output/server/manifest.js || {
  echo "visual regression requires a production build (.svelte-kit/output/server/manifest.js)" >&2
  exit 1
}

bun run app:prepare
bun run db:migrate:deploy
bunx prisma db seed
VISUAL_REGRESSION=1 bash tests/ci/e2e-run-shard.sh 1/1 visual-matrix
