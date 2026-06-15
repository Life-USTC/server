# Observability

Life@USTC emits production-safe structured logs and bounded Prometheus-style
runtime metrics. Logs and metrics must not include tokens, cookies, OAuth codes,
request bodies, raw query strings, upload object keys, signed URLs, or
high-cardinality resource IDs.

## Runtime Sources

- Logs use `logAppEvent` and Cloudflare Workers observability.
- API request metrics live in `src/lib/log/api-observability-recording.ts`.
- MCP, OAuth, audit, and storage metrics live in `src/lib/metrics/`.
- Runtime metric rendering lives in `src/lib/metrics/runtime-metrics.ts`.
- Request ids propagate through page and REST responses.

## Endpoints

- `/api/metrics` exposes Prometheus text from localhost or with
  `METRICS_BEARER_TOKEN`.
- `/api/readiness` reports DB, storage, and deployment readiness from localhost,
  with `READINESS_BEARER_TOKEN`, or with `METRICS_BEARER_TOKEN`.

## Alerts

Critical:

- Public blackbox probe failure for `https://life-ustc.tiankaima.dev`.
- Cloudflare Worker error spike.
- Sustained REST 5xx rate.
- Database readiness failure.

Warning:

- REST or MCP latency regression.
- OAuth token failure spike.
- MCP auth rejection spike.
- Storage or audit write error spike.

Dashboards should cover REST status and latency, MCP phases/tools, OAuth token
requests, audit writes, and storage operations.
