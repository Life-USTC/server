#!/usr/bin/env sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
if [ -n "${STATIC_SNAPSHOT_MANIFEST_URL:-}" ]; then
  exec bun run static:load:manifest
fi
default_url=https://static.life-ustc.tiankaima.dev/life-ustc-static.sqlite
work_dir=$(mktemp -d)
trap 'rm -rf "$work_dir"' EXIT

download() {
  curl --fail --location --silent --show-error --retry 3 --retry-delay 5 \
    --write-out '%{http_code}' --output "$work_dir/download" "$1"
}

if [ "${STATIC_SNAPSHOT_PATH+x}" = x ]; then
  input=$STATIC_SNAPSHOT_PATH
  if [ ! -f "$input" ]; then
    echo "Local snapshot not found: $input" >&2
    exit 1
  fi
  echo "Using local snapshot: $input"
else
  url=${STATIC_SNAPSHOT_URL:-"$default_url.gz"}
  echo "Downloading snapshot from $url"
  if ! status=$(download "$url"); then
    if [ -n "${STATIC_SNAPSHOT_URL:-}" ] || { [ "$status" != 404 ] && [ "$status" != 410 ]; }; then
      echo "Snapshot download failed (HTTP $status)" >&2
      exit 1
    fi
    download "$default_url" >/dev/null
  fi
  input=$work_dir/download
fi

if [ "$(od -An -tx1 -N2 "$input" | tr -d ' \n')" = 1f8b ]; then
  gzip -dc "$input" > "$work_dir/snapshot.sqlite"
  input=$work_dir/snapshot.sqlite
fi
STATIC_SNAPSHOT_PATH="$input" bun run static:load
