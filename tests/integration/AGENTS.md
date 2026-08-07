# tests/integration/

MCP in-process harness + REST Playwright contracts. Full recipes: root
`AGENTS.md` (same shape as CI `ci:integration`).

```bash
bun run db:migrate:deploy && bunx prisma db seed
bunx vitest run --config vitest.integration.config.ts
bun run build && bun run rest:test
```

## REST (`tests/integration/rest/`)

REST-only Playwright (`playwright.api.config.ts`) with `_harness/auth.ts`
request-based debug sign-in.

## MCP layout

```text
tests/integration/mcp/
  workspace/ · catalog/ · community/ · bus/
  profile.test.ts
  _harness/      client, context, fixtures, cleanup
```

## Harness (`_harness/`)

- `createMcpHarness` / `createAnonymousMcpHarness` — `client.ts`
- `createMcpToolTestContext()` — shared seed user, read-mostly
- `createIsolatedMcpToolTestContext()` — throwaway user for mutations; read
  `context.client` / `context.userId` at call time (don't destructure early)
- `createSubscribedIsolatedMcpToolTestContext()` — isolated + seed section
- `createEphemeralMcpUser()` — single-`it` user; call `close()` after cleanup
- Non-MCP DB tests: `createTestPrisma()` from `tests/shared/prisma.ts`

`fileParallelism` is off — auth row-count tests flake under concurrent session
writes. Prefer file-level isolation for mutating suites.

## Conventions

- `DEV_SEED_ANCHOR` from `tests/fixtures/dev-seed.ts`
- Mutation markers: `[integration-test] ...`
- Clean up created data; pass explicit `userId` into audit helpers when isolated
