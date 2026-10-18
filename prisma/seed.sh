#!/usr/bin/env sh
set -eu
if [ "${ALLOW_DATABASE_SEED:-}" != "true" ]; then
  echo "Refusing to seed without ALLOW_DATABASE_SEED=true" >&2
  exit 1
fi
: "${DATABASE_URL:?DATABASE_URL is required to seed}"

# Credential hashes are generated per run (see prisma/seed-credentials.ts) and
# handed to seed.sql as psql variables; none are committed.
credentials="$(mktemp)"
trap 'rm -f "$credentials"' EXIT
trap 'exit 1' HUP INT TERM
bun prisma/seed-credentials.ts >"$credentials"

psql -X -v ON_ERROR_STOP=1 --set=allow_database_seed=true "$DATABASE_URL" \
  -f "$credentials" -f prisma/seed.sql
