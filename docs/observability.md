# Observability

Life@USTC exposes production-safe structured logs and bounded Prometheus-style
runtime metrics. Logs and metrics must not include bearer tokens, cookies, OAuth
codes, request bodies, raw query strings, upload object keys, signed URLs, or
high-cardinality resource IDs.

## Log Storage

Structured app logs are always emitted to the app process stdout/stderr. Cloudflare
Workers production logs are collected through Cloudflare observability. In local
or non-Cloudflare runs, setting `APP_LOG_DIR` also appends server-side logs as
JSON Lines to `APP_LOG_DIR/app-YYYY-MM-DD.log`.

## Request Tracing

- Caddy access logs remain the edge source of truth for every HTTP request.
- SvelteKit REST routes propagate `x-request-id` and `x-request-start-ms`.
- REST route logs use normalized route templates such as `/api/todos/:id`.
- MCP transport logs include JSON-RPC method summaries, tool names, argument
  keys, status, duration, and registered tool count.

## Metrics

Runtime metrics are exposed as Prometheus text at `/api/metrics`. The endpoint
is readable from localhost or with `METRICS_BEARER_TOKEN`.

REST:

- `life_ustc_api_requests_started_total{method,route}`
- `life_ustc_api_requests_total{auth_mode,method,route,status}`
- `life_ustc_api_request_duration_ms_count{method,route}`
- `life_ustc_api_request_duration_ms_sum{method,route}`
- `life_ustc_api_errors_total{method,route,status}`

MCP:

- `life_ustc_mcp_http_requests_total{method,phase,status}`
- `life_ustc_mcp_http_request_duration_ms_count{method,phase}`
- `life_ustc_mcp_http_request_duration_ms_sum{method,phase}`
- `life_ustc_mcp_jsonrpc_requests_total{rpc_method}`
- `life_ustc_mcp_tool_calls_total{tool}`
- `life_ustc_mcp_tool_call_results_total{status,tool}`
- `life_ustc_mcp_tool_call_duration_ms_count{tool}`
- `life_ustc_mcp_tool_call_duration_ms_sum{tool}`

OAuth, audit, and storage:

- `life_ustc_oauth_token_requests_total{grant_type,has_resource,status}`
- `life_ustc_oauth_token_request_duration_ms_count{grant_type,has_resource}`
- `life_ustc_oauth_token_request_duration_ms_sum{grant_type,has_resource}`
- `life_ustc_audit_writes_total{action,status}`
- `life_ustc_audit_write_duration_ms_count{action}`
- `life_ustc_audit_write_duration_ms_sum{action}`
- `life_ustc_storage_operations_total{operation,status}`
- `life_ustc_storage_operation_duration_ms_count{operation}`
- `life_ustc_storage_operation_duration_ms_sum{operation}`

## Readiness

`/api/readiness` returns internal dependency status for DB reachability, storage
configuration, and process uptime. It is readable from localhost, with
`READINESS_BEARER_TOKEN`, or with `METRICS_BEARER_TOKEN`.

Use readiness for operator diagnostics.

## Alerts

Recommended critical alerts:

- Public blackbox probe failure for `https://life-ustc.tiankaima.dev`.
- Cloudflare Worker error spike.
- Sustained REST 5xx rate from `life_ustc_api_errors_total`.
- Database readiness failure.

Recommended warning alerts:

- REST or MCP latency regression from duration sum/count metrics.
- OAuth token failure spike.
- MCP auth rejection spike.
- Storage operation error spike.
- Audit write error spike.

## Dashboards

At minimum, Grafana should show:

- REST request rate, status class, top routes, and average latency.
- MCP HTTP phases, JSON-RPC methods, tool calls, tool failures, and latency.
- OAuth token requests by grant type/status.
- Audit write success/error counts.
- Storage operation success/error counts and latency.
