# tests/

Test layers. Architecture context: root `AGENTS.md`. Feature coverage
expectations: `$life-ustc-feature`.

| Layer | Path | Runner |
|-------|------|--------|
| Unit | `tests/unit/` | `bunx vitest run tests/unit` |
| Integration | `tests/integration/` | vitest integration config + `bun run rest:test` |
| E2E | `tests/e2e/` | `bun run e2e:test` / focused `bunx playwright test` |

Unit tests live under `tests/unit/` only; do not colocate `*.test.ts` under `src/`.

## Shared fixtures

- `tests/fixtures/dev-seed.ts` — `DEV_SEED`, `DEV_SEED_ANCHOR`
- `tests/e2e/fixtures/scenario.json` — source for seed SQL
- `tests/shared/deferred.ts` — concurrency helpers
- `tests/shared/prisma.ts` — Prisma client for non-MCP integration
- `tests/shared/scenarios/` — cross-adapter arrange/assert helpers

## Harness utilities

| Utility | Path |
|---------|------|
| Unit mock templates | `tests/unit/helpers/AGENTS.md` |
| MCP in-process client | `tests/integration/mcp/_harness/client.ts` |
| E2E page contracts | `tests/e2e/src/app/_shared/page-contract.ts` |

Layer notes: `tests/unit/AGENTS.md`, `tests/integration/AGENTS.md`, `tests/e2e/AGENTS.md`.
