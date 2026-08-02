#!/usr/bin/env bash
set -euo pipefail

# Query Cloudflare Analytics Engine SQL for the life_ustc_runtime dataset.
# Requires CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID (or uses wrangler whoami).

if [[ $# -lt 1 ]]; then
  cat <<'EOF'
Usage: scripts/analytics-query.sh "SELECT ..."

Examples:
  scripts/analytics-query.sh "SELECT blob2, COUNT() FROM life_ustc_runtime WHERE timestamp > NOW() - INTERVAL '1' DAY AND blob1 = 'public_runtime_cache_v2' AND index1 LIKE 'cache:page:section-detail:overview:%' GROUP BY blob2"
EOF
  exit 1
fi

account_id="${CLOUDFLARE_ACCOUNT_ID:-}"
if [[ -z "$account_id" ]]; then
  account_id="$(wrangler whoami 2>/dev/null | rg -o '[0-9a-f]{32}' | head -1 || true)"
fi

if [[ -z "$account_id" ]]; then
  echo "CLOUDFLARE_ACCOUNT_ID is required (or run wrangler whoami)." >&2
  exit 1
fi

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "CLOUDFLARE_API_TOKEN is required." >&2
  exit 1
fi

curl -sS \
  "https://api.cloudflare.com/client/v4/accounts/${account_id}/analytics_engine/sql" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -d "$1"
