#!/usr/bin/env sh
set -eu
psql "$DATABASE_URL" -f prisma/seed.sql
