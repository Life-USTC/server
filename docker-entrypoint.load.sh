#!/usr/bin/env sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${STATIC_SNAPSHOT_URL:?STATIC_SNAPSHOT_URL is required}"

bun run db:migrate:deploy

curl -L "$STATIC_SNAPSHOT_URL" -o /tmp/snapshot.db

# Minimal static load: feature parity with the legacy TypeScript loader is not required.
# The loader currently only validates the SQLite snapshot can be opened.
# Expand this section with sqlite3 → psql transforms when the full ETL is needed.
sqlite3 /tmp/snapshot.db ".tables"

echo "static load complete"
