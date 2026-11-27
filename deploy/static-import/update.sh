#!/bin/sh
set -eu
repo=${STATIC_IMPORT_REPO:-$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)}
cd "$repo"
compose="$(pwd)/deploy/static-import/compose.yml"
git pull --ff-only
export STATIC_IMPORT_IMAGE=${STATIC_IMPORT_IMAGE:-life-ustc-static-import:local}
docker compose -f "$compose" build --pull
docker compose -f "$compose" up --detach --remove-orphans
