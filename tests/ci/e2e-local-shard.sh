#!/usr/bin/env bash
set -euo pipefail

readonly shard="$1"
readonly shard_total="$2"
readonly database_url="$3"
shift 3

export FUNCTION_OWNER_DATABASE_URL="$database_url"
export ALLOW_TEST_DATABASE_SETUP=true
export E2E_REPORT_ROOT="playwright-report/local-parallel/shard-${shard}"
source tests/ci/setup-runtime-database.sh
exec bunx playwright test --shard="${shard}/${shard_total}" \
  --pass-with-no-tests \
  "$@"
