#!/bin/sh
set -eu
if [ "$(id -u)" -ne 0 ]; then
  echo "install.sh must run as root" >&2
  exit 1
fi
repo=/opt/life-ustc-static-import/current
test -x "$repo/deploy/static-import/update.sh"
docker compose version >/dev/null
install -d -m 750 /etc/life-ustc-static-import
for name in webhook importer; do
  if [ ! -f "/etc/life-ustc-static-import/$name.env" ]; then
    install -m 600 /dev/null "/etc/life-ustc-static-import/$name.env"
  fi
done
install -m 644 "$repo/deploy/static-import/static-import.service" /etc/systemd/system/
install -m 644 "$repo/deploy/static-import/static-import-update.service" /etc/systemd/system/
install -m 644 "$repo/deploy/static-import/static-import-update.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable static-import.service static-import-update.timer
printf '%s\n' 'Configure both env files, then run: systemctl start static-import.service static-import-update.timer'
