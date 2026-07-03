#!/usr/bin/env sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${STATIC_SNAPSHOT_URL:=https://static.life-ustc.tiankaima.dev/life-ustc-static.sqlite}"

bun run db:migrate:deploy

curl -fL --retry 3 --retry-delay 5 "$STATIC_SNAPSHOT_URL" -o /tmp/snapshot.db

scripts/load-static-sqlite.sh /tmp/snapshot.db

echo "static load complete"
