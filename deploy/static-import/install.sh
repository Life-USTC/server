#!/bin/sh
set -eu
if [ "$(id -u)" -ne 0 ]; then
  echo "install.sh must run as root" >&2
  exit 1
fi
repo=${STATIC_IMPORT_REPO:-$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)}
test -x "$repo/deploy/static-import/update.sh"
docker compose version >/dev/null
install -d -m 750 /etc/life-ustc-static-import
for name in webhook importer; do
  if [ ! -f "/etc/life-ustc-static-import/$name.env" ]; then
    install -m 600 /dev/null "/etc/life-ustc-static-import/$name.env"
  fi
done
escaped_repo=$(printf '%s' "$repo" | sed 's/[\\&|]/\\&/g')
for unit in static-import.service static-import-update.service; do
  sed "s|@STATIC_IMPORT_REPO@|$escaped_repo|g" "$repo/deploy/static-import/$unit" |
    install -m 644 /dev/stdin "/etc/systemd/system/$unit"
done
install -m 644 "$repo/deploy/static-import/static-import-update.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable static-import.service static-import-update.timer
printf '%s\n' 'Configure both env files, then run: systemctl start static-import.service static-import-update.timer'
