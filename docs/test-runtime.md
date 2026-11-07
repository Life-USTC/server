# Test runtime and fixtures

Setup and role environment variables: [local development](local-development.md).
Choose the runtime for the boundary being tested:

| Boundary                          | Entry point                                                              | What it exercises                                                       |
| --------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Pure logic / mocked orchestration | [Unit config](../vitest.config.ts)                                       | Node code without real DB or Worker bindings                            |
| Database                          | [isolatedDatabaseTest](../tests/shared/isolated-database.ts)             | Private migrated DB with production roles and RLS                       |
| Node protocol                     | [nodeProtocolTest](../tests/shared/node-protocol-fixture.ts)             | Handlers with restricted DB roles and explicit test bindings            |
| MCP SDK                           | [isolatedMcpTest](../tests/integration/mcp/_harness/isolated-context.ts) | SDK client/server over in-memory transport and synthetic authentication |
| Worker HTTP / browser             | [isolated Worker](../tests/e2e/utils/isolated-worker.ts)                 | Compiled application in workerd, real HTTP and Worker bindings          |

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

Account browser scenarios can attach an independent persisted-state callback as
the fifth field of a planned write in
[accountRun](../tests/e2e/utils/account-fixture.ts). The owned request proxy waits
for both response and state checks before releasing the response to the browser;
a response assertion failure still runs the state check. Define expectations from
scenario inputs, including intermediate values before a rollback. The profile
save journey uses this boundary while retaining both reloads, visible toasts and
post-drain state/audit checks. Writes made through `page.request` use the native
Worker transport ledger and cannot satisfy a browser state callback.

Calendar effect observations use a fresh native request context for each phase.
For the isolated Worker's HTTP `localhost` origin, those anonymous probes connect
to its IPv4 listener directly while retaining the original `Host` header. This
avoids address-family fallback during each connection without changing browser
cookies, WebAuthn or OAuth origins. HTTPS and other hosts retain their original
endpoint. Each phase still consumes its responses and disposes its context, even
when observation fails.

### Owned browser transport

The isolated Worker fixture gives each case a loopback SOCKS5 proxy via
Playwright's public context `proxy` option. Only the exact owned `localhost`
hostname and port select IPv4; other authorities retain normal address selection.
`@pondwader/socks5-server` handles the protocol through its documented connection
handler and custom-Duplex entry point. The fixture owns both raw socket endpoints,
without HTTP parsing, URL rewriting, cookie copying or process-global agents.
HTTP, HTTPS and redirects retain the original browser-managed cookie jar.

`withSettledPageWrites` retains native `route.fetch({ maxRedirects: 0 })`, zero
retries, observation before fulfillment and its write drain. The original browser
context and its associated requests close before the proxy, then the
Worker/database owner. Proxy disposal joins listener startup
and **both source and target socket close events**; late handshakes cannot allocate
a target after teardown. Native cases cover HTTP/non-owned HTTPS, cookie boundaries,
redirects, resets, cancellation and partial startup. HTTPS controls generate a
disposable certificate with OpenSSL and verify default certificate rejection.

## Runtime role preflight

`prisma/roles/verify-app-runtime.sql` reports role/grant metadata and boolean
checks. Supply the reviewed expected privilege allowlists described in its
header; do not construct the expected contract from a potentially drifted target.
The owner-family check validates its exact owner predicate. The separate
`collaborative_policy_inventory` check requires enabled/forced RLS and the
reviewed runtime-applicable policy names, commands, roles and permissiveness for
Comment, Description, DescriptionEdit, Homework, CommentAttachment and User;
unexpected runtime policies fail the preflight. This inventory does not compare
the collaborative policy expressions. Their family integration suites establish
read/write semantics, including public reads and restricted actor behavior.
A passing disposable-database preflight does not establish production effective
permissions or completion of the importer identity rollout.
