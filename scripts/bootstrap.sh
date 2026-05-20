#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ "${1:-}" != "" && "${1:-}" != "--with-infra" ]]; then
  echo "Usage: scripts/bootstrap.sh [--with-infra]" >&2
  exit 2
fi

bun install --frozen-lockfile

if [[ "${1:-}" == "--with-infra" ]]; then
  bun run dev:infra
  bun run app:prepare:dev
fi
