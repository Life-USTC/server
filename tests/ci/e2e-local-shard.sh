#!/usr/bin/env bash
set -euo pipefail

readonly shard="$1"
readonly shard_total="$2"
readonly database_url="$3"
readonly worker_port="$4"
readonly inspector_port="$5"
readonly temp_dir="$6"
shift 6

export DATABASE_URL="$database_url"
export ALLOW_DATABASE_SEED=true
export E2E_PORT="$worker_port"
export E2E_INSPECTOR_PORT="$inspector_port"
export PLAYWRIGHT_BASE_URL="http://localhost:${worker_port}"
export E2E_PERSIST_TO="${temp_dir}/wrangler-${shard}"
export E2E_REPORT_ROOT="playwright-report/local-parallel/shard-${shard}"
export CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE="$database_url"
export CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_AUTH="$database_url"
export CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_MAINTENANCE="$database_url"

bun run db:migrate:deploy
bunx prisma db seed
bash tests/ci/e2e-run-shard.sh "${shard}/${shard_total}" \
  --pass-with-no-tests \
  "$@"
