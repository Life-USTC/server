#!/bin/sh
set -eu
repo=/opt/life-ustc-static-import/current
compose="$repo/deploy/static-import/compose.yml"
cd "$repo"
git pull --ff-only
export STATIC_IMPORT_IMAGE=${STATIC_IMPORT_IMAGE:-life-ustc-static-import:local}
docker compose -f "$compose" build --pull
docker compose -f "$compose" up --detach --remove-orphans
