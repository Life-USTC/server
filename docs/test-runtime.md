# Test runtime and fixtures

Setup and role environment variables: [local development](local-development.md).
Choose the runtime for the boundary being tested:

| Boundary | Entry point | What it exercises |
| --- | --- | --- |
| Pure logic / mocked orchestration | [Unit config](../vitest.config.ts) | Node code without real DB or Worker bindings |
| Database | [isolatedDatabaseTest](../tests/shared/isolated-database.ts) | Private migrated DB with production roles and RLS |
| Node protocol | [nodeProtocolTest](../tests/shared/node-protocol-fixture.ts) | Handlers with restricted DB roles and explicit test bindings |
| MCP SDK | [isolatedMcpTest](../tests/integration/mcp/_harness/isolated-context.ts) | SDK client/server over in-memory transport and synthetic authentication |
| Worker HTTP / browser | [isolated Worker](../tests/e2e/utils/isolated-worker.ts) | Compiled application in workerd, real HTTP and Worker bindings |

Node protocol and in-memory MCP tests do not establish real Worker HTTP
or authentication behavior. Runtime ownership contracts live beside the APIs:
[Node](../tests/shared/node-runtime.ts),
[Worker](../tests/e2e/utils/owned-worker.ts),
[browser](../tests/e2e/utils/owned-page.ts), and
[MCP](../tests/integration/mcp/_harness/isolated-context.ts).

## Database and Worker isolation

Each application case owns an empty migrated DB clone; `owner` arranges data and
observes persisted effects while application calls use restricted app/auth/maintenance
connections. Worker cases, including anonymous reads, also own their process,
origin and storage: a read can populate caches or enqueue background work.
`createActor` / `createSession` bypass sign-in; use the real sign-in flow when testing it.
Self-contained platform checks can own a separate Wrangler harness without a DB;
[request-ID checks](../tests/e2e/src/app/infrastructure/worker-request-id-platform.test.ts)
are one example.

## Runner configuration and retries

[Test tags](../tests/ci/test-tags.ts) identify the operation under test and drive
[CI grouping](../tests/ci/test-matrix.ts). Runner settings live in the
[integration config](../vitest.integration.config.ts),
[Worker HTTP config](../playwright.api.config.ts), and
[browser config](../playwright.config.ts); CI overrides live in the
[workflow](../.github/workflows/ci.yml).

Per-request `maxRetries: 1` is reserved for observations without side effects
when a connection resets; the call site records why retrying is safe. A GET alone
does not establish safety: catalog-link resolution records visits.
[Retry regressions](../tests/integration/playwright-request-retry.test.ts)
verify transport behavior, not call-site selection.

## Browser coverage

[Page inventory](../tests/e2e/src/app/_shared/page-inventory.ts) lists desktop/mobile
route samples; it does not establish behavior coverage.
[Page contracts](../tests/e2e/src/app/_shared/page-contract.ts) compose common checks.
The [accessibility helper](../tests/e2e/utils/ui-quality.ts) runs the selected WCAG A/AA axe rules, including contrast and target size.
Serious/critical violations fail the gate; incomplete results are reported for
review. A passing audit does not establish full accessibility coverage.
