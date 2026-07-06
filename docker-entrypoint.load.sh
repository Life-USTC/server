#!/usr/bin/env sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"

bun run db:migrate:deploy

exec "$@"
