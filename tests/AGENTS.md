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
