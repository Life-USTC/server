# tests/

Test layers. Layout and local checks: root `AGENTS.md`. Coverage expectations
when changing behavior: `$life-ustc-implement`.

| Layer | Path | Runner |
|-------|------|--------|
| Unit | `tests/unit/` | `bunx vitest run tests/unit` |
| Integration | `tests/integration/` | vitest integration config + `bun run rest:test` |
| E2E | `tests/e2e/` | `ALLOW_DATABASE_SEED=true bun run e2e:test` / focused `bunx playwright test` |

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
