#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

command -v bun >/dev/null || {
  echo "bun is required" >&2
  exit 1
}

expected_bun="$(tr -d '[:space:]' < .bun-version)"
actual_bun="$(bun --version)"

if [[ "$actual_bun" != "$expected_bun" ]]; then
  echo "Expected bun $expected_bun, found $actual_bun" >&2
  exit 1
fi

bun run check:features
bun run check:routes
