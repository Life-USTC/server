# tests/

Test layers for the server repo. Shared setup and commands live in the repo root
`AGENTS.md` and `$life-ustc-dev-loop`.

| Layer | Path | Runner |
|-------|------|--------|
| Unit | `tests/unit/` | `bunx vitest run tests/unit` |
| Integration | `tests/integration/` | `bunx vitest run --config vitest.integration.config.ts` |
| E2E | `tests/e2e/` | `bunx playwright test` |

Unit tests live under `tests/unit/` only; do not colocate `*.test.ts` under `src/`.

## Shared fixtures

- `tests/fixtures/dev-seed.ts` — canonical seed constants (`DEV_SEED`, `DEV_SEED_ANCHOR`)
- `tests/e2e/fixtures/scenario.json` — source data for seed SQL
- `tests/shared/deferred.ts` — `createDeferred` for concurrency/overlap tests
- `tests/shared/prisma.ts` — dedicated Prisma client for non-MCP integration tests
- `tests/shared/scenarios/` — cross-adapter arrange/assert helpers (overview, todo CRUD, homework create)

## Harness utilities

| Utility | Path |
|---------|------|
| Unit mock templates | `tests/unit/helpers/AGENTS.md` |
| MCP in-process client | `tests/integration/mcp/_harness/client.ts` (`createMcpHarness`, `createAnonymousMcpHarness`) |
| MCP integration setup | `tests/integration/mcp/_harness/` |
| E2E page contracts | `tests/e2e/src/app/_shared/page-contract.ts` |

Layer-specific notes: `tests/unit/AGENTS.md`, `tests/integration/AGENTS.md`, `tests/e2e/AGENTS.md`.
