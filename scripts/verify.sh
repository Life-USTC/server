#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

target="${1:-fast}"
shift || true

case "$target" in
  fast)
    bun run verify:fast "$@"
    ;;
  full)
    bun run verify:full "$@"
    ;;
  e2e)
    bun run verify:e2e "$@"
    ;;
  check)
    bun run check:all "$@"
    ;;
  typecheck)
    bun run typecheck "$@"
    ;;
  unit)
    bun run test "$@"
    ;;
  integration)
    bun run test:integration "$@"
    ;;
  *)
    echo "Usage: scripts/verify.sh [fast|full|e2e|check|typecheck|unit|integration] [args...]" >&2
    exit 2
    ;;
esac
