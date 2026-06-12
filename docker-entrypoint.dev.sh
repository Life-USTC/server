#!/bin/sh
set -eu

STAMP_FILE=/usr/src/app/node_modules/.bun-install-stamp

mkdir -p /home/bun/.bun/install/cache /usr/src/app/node_modules
chown -R bun:bun \
  /home/bun/.bun \
  /usr/src/app/node_modules \
  /usr/src/app/src/generated/prisma

need_install=0
if [ ! -f "$STAMP_FILE" ]; then
  need_install=1
elif [ package.json -nt "$STAMP_FILE" ] || [ bun.lock -nt "$STAMP_FILE" ]; then
  need_install=1
fi
export NEED_INSTALL="$need_install"

exec su -m bun -s /bin/sh -c \
  "cd /usr/src/app && ( [ \"$NEED_INSTALL\" -ne 0 ] && bun install --frozen-lockfile; touch \"$STAMP_FILE\" ) && bun run prisma generate && bun run prisma migrate deploy && ./node_modules/.bin/vite dev --host 0.0.0.0 --port 3000 --strictPort"
