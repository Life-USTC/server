#!/usr/bin/env sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${STATIC_SNAPSHOT_URL:=https://static.life-ustc.tiankaima.dev/life-ustc-static.sqlite}"

if [ "${STATIC_SNAPSHOT_PATH+x}" = x ]; then
  if [ -z "$STATIC_SNAPSHOT_PATH" ] || [ ! -f "$STATIC_SNAPSHOT_PATH" ]; then
    echo "Local snapshot not found: ${STATIC_SNAPSHOT_PATH}" >&2
    exit 1
  fi
  echo "Using local snapshot: ${STATIC_SNAPSHOT_PATH}"
  STATIC_SNAPSHOT_PATH="$STATIC_SNAPSHOT_PATH" bun run static:load
  exit 0
fi

SNAPSHOT_PATH="$(mktemp /tmp/life-ustc-static-XXXXXX.sqlite)"
cleanup() {
  rm -f "$SNAPSHOT_PATH"
}
trap cleanup EXIT INT TERM

echo "Downloading snapshot from ${STATIC_SNAPSHOT_URL}"
curl -fL --retry 3 --retry-delay 5 "$STATIC_SNAPSHOT_URL" -o "$SNAPSHOT_PATH"
echo "Download complete"

STATIC_SNAPSHOT_PATH="$SNAPSHOT_PATH" bun run static:load
