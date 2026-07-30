#!/usr/bin/env sh
set -eu
if [ "${ALLOW_DATABASE_SEED:-}" != "true" ]; then
  echo "Refusing to seed without ALLOW_DATABASE_SEED=true" >&2
  exit 1
fi
psql -X -v ON_ERROR_STOP=1 "$DATABASE_URL" -f prisma/seed.sql
