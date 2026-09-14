#!/usr/bin/env bash
set -euo pipefail

shard="$1"
shard_total="$2"
export FUNCTION_OWNER_DATABASE_URL="$3"
export ALLOW_DATABASE_SEED=true
shift 3

source tests/ci/setup-runtime-database.sh
bunx vitest run --config vitest.integration.config.ts --shard="${shard}/${shard_total}" "$@"
