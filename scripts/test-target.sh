#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

layer="${1:-}"
if [[ -z "$layer" ]]; then
  echo "Usage: scripts/test-target.sh [unit|integration|e2e] <path-or-vitest/playwright args...>" >&2
  exit 2
fi
shift

case "$layer" in
  unit)
    bun run test -- "$@"
    ;;
  integration)
    bun run test:integration -- "$@"
    ;;
  e2e)
    bun run test:e2e -- "$@"
    ;;
  *)
    echo "Usage: scripts/test-target.sh [unit|integration|e2e] <path-or-vitest/playwright args...>" >&2
    exit 2
    ;;
esac
