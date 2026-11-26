# Containerized static import

The jp-2 deployment runs the webhook and importer as two containers from the
same locally built image. No Bun or Python application is installed on the host.

## Runtime contract

- `webhook` listens on host loopback `127.0.0.1:8787` and accepts only signed
  `POST /api/static-import` deliveries. `GET /healthz` exposes queue counts but
  no credentials or article data.
- `worker` consumes the persistent SQLite queue and reconciles the published
  manifest every five minutes. The existing import lock and manifest generation
  checks remain authoritative across other importers.
- The queue is a named Docker volume. Snapshot bytes use a separate bounded
  cache volume. Both containers have read-only root filesystems, no Linux
  capabilities, and independent CPU, memory, and PID limits. Only the worker
  joins the external `postgres_default` database network; the webhook does not.
- `static-import-update.timer` fast-forwards the deployment checkout, builds
  `life-ustc-static-import:local` with Docker BuildKit, and recreates changed
  containers every five minutes. It needs no registry credential and never
  prunes unrelated Docker resources.

## Configuration

Install Docker with the Compose plugin, then clone the server repository to
`/opt/life-ustc-static-import/current`. As root, run
`deploy/static-import/install.sh` once.

`/etc/life-ustc-static-import/webhook.env`:

```sh
STATIC_IMPORT_WEBHOOK_SECRET=use-a-long-random-secret
```

`/etc/life-ustc-static-import/importer.env`:

```sh
DATABASE_URL=postgresql://life_ustc_importer:...@postgres:5432/life_ustc
APP_PUBLIC_ORIGIN=https://life-ustc.tiankaima.dev
EDGE_CACHE_PURGE_SECRET=...
```

Keep both files root-owned with mode `0600`. The webhook container receives only
its HMAC secret. The worker receives only the importer and purge settings. The
Cloudflare zone ID and API token remain Worker secrets; the authenticated
internal endpoint purges both the zone and Workers entrypoint caches. Database
schema deployment remains with DB Migrate Deploy; the importer has no migration
credentials.

Publish the webhook through the host TLS reverse proxy without exposing the
container port publicly. Configure the static repository with:
- `STATIC_IMPORT_WEBHOOK_URL=https://jp-2.s.tiankaima.dev/api/static-import`
- the same `STATIC_IMPORT_WEBHOOK_SECRET`

The signed payload contains only the manifest URL, generation, and snapshot SHA.
It never includes database or school credentials.

Start the service and updater:

```sh
systemctl start static-import.service static-import-update.timer
systemctl status static-import.service static-import-update.timer
journalctl -u static-import-update.service
docker compose -f /opt/life-ustc-static-import/current/deploy/static-import/compose.yml ps
```

For rollback, disable the static webhook trigger and the jp-2 updater, stop the
containers with `docker compose ... stop`, and resume the server Static Sync
workflow. Existing manifest generation and import-state checks prevent an older
snapshot from replacing a newer one.
