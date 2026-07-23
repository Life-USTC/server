# Observability

Life@USTC emits production-safe structured logs and Cloudflare Analytics Engine
datapoints. Logs and metrics must not include tokens, cookies, OAuth codes,
request bodies, raw query strings, upload object keys, signed URLs, or
high-cardinality resource IDs.

## Runtime Sources

- Logs use `logAppEvent` and Cloudflare Workers observability. Production
  exception fields retain only an allowlisted error class, never the exception
  message or stack.
- Worker invocation logs use 25% head sampling and traces use 5% head
  sampling. Source maps are uploaded with each production Worker deployment.
  Custom spans identify session lookup, SvelteKit dispatch, MCP authentication,
  MCP body parsing/SDK dispatch, and GraphQL dispatch without attaching
  credentials, request bodies, or resource identifiers.
- Built-in Worker request/error metrics remain the source for complete traffic
  and 5xx counts. Unsampled Analytics Engine events preserve safe API, MCP,
  OAuth, GraphQL, database connection/pool, audit, storage, and cache outcomes;
  sampled logs and traces provide request-level diagnosis.
- Production API request metrics are written to Cloudflare Analytics Engine.
- API request metrics live in `src/lib/log/api-observability-recording.ts`.
- Every `/api/*` request receives one server-generated request ID and records
  exactly one finish or error outcome, including early CSRF responses,
  unmatched routes, auth catch-all routes, and handler exceptions. Client
  `x-request-id` values are not trusted as the server correlation ID.
- GraphQL observations distinguish expected GraphQL errors from
  `INTERNAL_SERVER_ERROR`; only the latter are logged at error severity.
- Request IDs propagate through page and REST responses.

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

## Worker configuration drift

`worker-configuration.d.ts` is generated from `wrangler.jsonc` with
`bunx wrangler types --include-runtime=false`. CI runs the matching `--check`
command so binding or variable changes cannot drift from the generated
environment contract. Run generation after `bun run app:prepare` and before a
production build so Wrangler does not couple the binding contract to a local
generated Worker entrypoint.
