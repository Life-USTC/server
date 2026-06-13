#!/usr/bin/env sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

bun run prisma migrate deploy
exec bun dist/tools/load/load-from-static.js "$@"
