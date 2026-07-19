# Observability

Life@USTC emits production-safe structured logs and Cloudflare Analytics Engine
datapoints. Logs and metrics must not include tokens, cookies, OAuth codes,
request bodies, raw query strings, upload object keys, signed URLs, or
high-cardinality resource IDs.

## Runtime Sources

- Logs use `logAppEvent` and Cloudflare Workers observability.
- Production API request metrics are written to Cloudflare Analytics Engine.
- API request metrics live in `src/lib/log/api-observability-recording.ts`.
- Request ids propagate through page and REST responses.

## Endpoints

`GET /api/health` is a public, unauthenticated process-liveness endpoint that
returns `ok`. No internal metrics or dependency-readiness endpoints are exposed
by the app.

## Alerts

Critical:

- Public blackbox probe failure for `https://life-ustc.tiankaima.dev`.
- Cloudflare Worker error spike.
- Sustained REST 5xx rate.
- Database connection failure or sustained query errors.

Warning:

- REST or MCP latency regression.
- OAuth token failure spike.
- MCP auth rejection spike.
- Storage or audit write error spike.

Dashboards should cover REST status and latency from Analytics Engine, with
structured logs used for MCP, OAuth, audit, and storage investigations.
