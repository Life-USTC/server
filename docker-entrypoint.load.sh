#!/usr/bin/env sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"

echo "Deploying database migrations..."
bun run db:migrate:deploy

exec scripts/load-static-sqlite.sh
