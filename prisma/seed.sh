#!/usr/bin/env sh
set -eu
psql -X -v ON_ERROR_STOP=1 "$DATABASE_URL" -f prisma/seed.sql
