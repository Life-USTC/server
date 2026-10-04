# tests/

Test layers. Layout and local checks: root `AGENTS.md`. Coverage expectations
when changing behavior: `$life-ustc-implement`.

| Layer | Path | Execution and isolation |
|-------|------|-------------------------|
| Unit | `tests/unit/` | `bunx vitest run --coverage`; files run in parallel with isolated mocks |
| Integration | `tests/integration/` | `bun run integration:test:parallel`; four independent PostgreSQL shards, serial files within each |
| RLS / role contracts | `tests/integration/*-rls.test.ts` and role contracts | Dedicated CI job and the default local parallel runner enable all role-test gates against the production bootstrap |
| HTTP | `tests/integration/rest/` | `bun run rest:test`; eight CI shards with two workers each; each case owns its database and real Worker |
| Browser | `tests/e2e/` | 16 Chromium CI shards and one Mobile Chrome job, two workers each; locally `bun run e2e:test:local --workers=2` or `bun run e2e:test` with prepared roles |

CI static checks, unit coverage, integration shards, RLS, and the test build start
independently. HTTP and browser jobs consume the single `test-build` artifact:
the application plus immutable compiled Worker code in `.svelte-kit/test-worker`.
Local `e2e:test:local` owns one temporary PostgreSQL service; native Playwright
workers schedule the isolated cases. `e2e:test` and `rest:test` invoke Playwright directly after database setup
and `bun run build` followed by `bun run build:test-worker` (see root `AGENTS.md`).
The local launcher runs both builds automatically. Browser HTML reports and failure artifacts
are under `playwright-report/` (or the explicit `E2E_REPORT_ROOT`).
CI uses native `--fully-parallel --workers=2` so Playwright shards individual
cases instead of keeping a long file on one runner. Local defaults remain one
worker with serial files; the same native options are available for reproduction.
Visual projects remain in the separate opt-in visual job.
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

- Mutation cases independently prepare the state required by one operation, act
  through the supported real entry point (Web, REST, GraphQL, MCP), and independently
  observe the expected persisted state. Update, remove and repeat-operation cases
  seed their own preconditions; an earlier create test or CRUD step is not setup.
  Include ownership, invalid input and rejection without partial effects. Assert
  each transport's response and authorization contract as well as shared state.
- Consumer tests independently prepare a known state, then verify its projections
  through the supported interfaces and pages. Apply each consumer's filtering,
  timing, ordering and visibility rules rather than demanding identical JSON.

Keep operation adapters, state fixtures/observers and expected assertions separate.
Adapters must use the interface under test, not bypass it through a shared use-case.
An observer may read the database directly, but must not compute its expected result
with the production logic it is checking. Database state alone cannot prove cache,
UI, object storage or asynchronous effects; observe those explicitly in the module
that owns the promised behavior. A refresh or cache requirement still needs its
actual boundary checked, including an already-open view when specified. Do not add
separate cross-entrypoint or complete-journey layers that repeat these checks.
Choose concrete state transitions and invariants instead of the full Cartesian
product of writers, readers, actors and presentation states. Preserve dedicated
permission and transaction regressions as well as entry-point checks.

Tests use explicit expected data maintained alongside the test. Shared helpers
observe actual state and accept explicit expected values; they do not read feature
specifications or record field-consumption receipts. Agents may author tests; reviewers own the requirements, oracle and
assertion quality. Never weaken expectations or skip failures automatically.

Mutable actors and records belong to a test, including resources acquired before
the test body starts. Use runner fixtures with failure-safe teardown, atomic
database-only setup, and exact owned IDs for cleanup. A shared immutable catalog
fixture is acceptable; a shared user whose preferences are restored afterward is
not a new isolation pattern. Global maintenance and version activation need their
own database/service environment. Do not increase suite concurrency until the
affected cases have passed standalone, reordered and concurrent validation.
