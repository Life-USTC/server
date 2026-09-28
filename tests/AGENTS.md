# tests/

Test layers. Layout and local checks: root `AGENTS.md`. Coverage expectations
when changing behavior: `$life-ustc-implement`.

| Layer | Path | Execution and isolation |
|-------|------|-------------------------|
| Unit | `tests/unit/` | `bunx vitest run --coverage`; files run in parallel with isolated mocks |
| Integration | `tests/integration/` | `bun run integration:test:parallel`; four independent PostgreSQL shards, serial files within each |
| RLS / role contracts | `tests/integration/*-rls.test.ts` and role contracts | Dedicated CI job and the default local parallel runner enable all role-test gates against the production bootstrap |
| REST | `tests/integration/rest/` | `bun run rest:test`; two isolated CI shards, each with its own database and real Worker |
| Browser | `tests/e2e/` | Eight isolated CI shards; locally `bun run e2e:test:parallel` or serial `bun run e2e:test` |

CI static checks, unit coverage, integration shards, RLS, and the application
build start independently. REST and browser jobs consume that single build.
Coverage reports measure unit execution of `src/**/*.ts`; database and browser
tests separately verify real permissions and transport behavior. Keep every
layer enabled when changing orchestration.

Unit tests live under `tests/unit/` only; don't colocate `*.test.ts` under `src/`.

## Shared fixtures

- `tests/fixtures/dev-seed.ts` — `DEV_SEED`, `DEV_SEED_ANCHOR`
- `tests/e2e/fixtures/scenario.json` — shared scenario data for fixtures / seed
- `tests/shared/deferred.ts` — concurrency helpers
- `tests/shared/prisma.ts` — Prisma client for non-MCP integration
- `tests/shared/scenarios/` — cross-transport arrange/assert helpers

## Harness utilities

| Utility | Path |
|---------|------|
| Unit hoisted mock notes | `tests/unit/AGENTS.md` |
| MCP in-process client | `tests/integration/mcp/_harness/client.ts` |
| E2E page contracts | `tests/e2e/src/app/_shared/page-contract.ts` |

## Modular acceptance tests

Maintain requirements and test correspondence manually. YAML acceptance pointers
are review aids; test execution must not depend on a specification-name registry,
a one-requirement/one-test rule, or semantic receipts.

Separate business checks by responsibility:

- Mutation tests act through each supported real entry point (Web, REST, GraphQL,
  MCP), then independently observe the expected persisted state. Include ownership,
  repeat operations, invalid input and rejection without partial effects. Assert
  each transport's own response and authorization contract as well as shared state.
- Consumer tests independently prepare a known state, then verify its projections
  through the supported interfaces and pages. Apply each consumer's filtering,
  timing, ordering and visibility rules rather than demanding identical JSON.
- Connection tests change state through an entry point and observe another consumer
  in the same session or after refresh. Cover cache invalidation and already-open
  views that independent fixture-based read/write checks cannot prove.
- Selected complete journeys verify that essential user tasks work end to end.
  Keep scenarios independently runnable; never depend on an earlier test's output.

Keep operation adapters, state fixtures/observers and expected assertions separate.
Adapters must use the interface under test, not bypass it through a shared use-case.
An observer may read the database directly, but must not compute its expected result
with the production logic it is checking. Database state alone cannot prove cache,
UI, object storage or asynchronous effects; observe those explicitly when required.
Choose concrete state transitions and invariants instead of the full Cartesian
product of writers, readers, actors and presentation states. Preserve dedicated
permission and transaction regressions as well as entry-point checks.

New tests use explicit expected data maintained alongside the test. Existing typed
comparison helpers remain in other features, but their metadata is not an acceptance
coverage claim. Agents may author tests; reviewers own the requirements, oracle and
assertion quality. Never weaken expectations or skip failures automatically.
