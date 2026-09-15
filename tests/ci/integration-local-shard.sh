#!/usr/bin/env bash
set -euo pipefail

shard="$1"
shard_total="$2"
export FUNCTION_OWNER_DATABASE_URL="$3"
export ALLOW_DATABASE_SEED=true
shift 3

for role_test_flag in \
  RLS_TEST_ENABLED \
  AUTH_ROLE_TEST_ENABLED \
  FUNCTION_OWNER_ROLE_TEST_ENABLED \
  MAINTENANCE_ROLE_TEST_ENABLED; do
  if [[ -v "$role_test_flag" && "${!role_test_flag}" != "true" ]]; then
    echo "$role_test_flag must be true for an integration shard." >&2
    exit 1
  fi
  export "$role_test_flag=true"
done

source tests/ci/setup-runtime-database.sh
bunx vitest run --config vitest.integration.config.ts --shard="${shard}/${shard_total}" "$@"
