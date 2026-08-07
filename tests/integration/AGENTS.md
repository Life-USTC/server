# tests/integration/

Integration tests with in-process MCP harness + REST Playwright contracts.

## Commands

```bash
bun run db:migrate:deploy
bunx prisma db seed
bunx vitest run --config vitest.integration.config.ts
bun run build
bun run rest:test   # playwright.api.config.ts — also part of CI ci:integration
```

Shared fixtures/harness index: `tests/AGENTS.md` and root `AGENTS.md`.

## REST contract tests (`tests/integration/rest/`)

REST-only Playwright specs (no browser UI) use `playwright.api.config.ts` and
`_harness/auth.ts` for request-based debug sign-in.

## MCP layout

```text
tests/integration/mcp/
  workspace/     overview, todos, subscriptions, calendar, dashboard links
  catalog/       search, section records
  community/     comments, descriptions, homework mutations
  bus/           preferences, timetable
  profile.test.ts
  _harness/      client, context, fixtures, cleanup
```

## MCP harness (`tests/integration/mcp/_harness/`)

- `client.ts` — `createMcpHarness`, `createAnonymousMcpHarness`
- `context.ts` — `createMcpToolTestContext()`, isolated / subscribed / ephemeral helpers
- `fixtures.ts` — `DEV_SEED`, seed date constants
- `cleanup.ts` — delete helpers, audit waiters, subscription helpers

- `createMcpToolTestContext()` — shared seed user for read-mostly tools (app Prisma via fixtures).
- `createIsolatedMcpToolTestContext()` — throwaway user for mutations; optional `setup` after user create.
  Read `context.client` / `context.userId` at call time — do not destructure early (`beforeAll` assigns later).
- `createSubscribedIsolatedMcpToolTestContext()` — isolated user already on seed section; exposes `seedSectionId`.
- `deleteIntegrationHomework()` / `deleteIntegrationTodo()` / `deleteIntegrationExam(jwId)` — cascade cleanup.
- `createEphemeralMcpUser()` — single-`it` throwaway user; call `close()` after cleanup.
- Non-MCP integration tests: `createTestPrisma()` from `tests/shared/prisma.ts`.

MCP mutations use isolated contexts; shared context is read-only. Factories
`prisma.$disconnect()` in `afterAll`.

`fileParallelism` is off in `vitest.integration.config.ts` — auth row-count tests
flake if concurrent files touch sessions/tokens. Prefer file-level isolation for
mutating files; see `mcp/community/comments.test.ts` for mixed patterns.

## Conventions

- Use `DEV_SEED_ANCHOR` from `tests/fixtures/dev-seed.ts`.
- Mutation markers: `[integration-test] ...`
- Clean up created data; read-only seed asserts need none.
- Pass explicit `userId` into audit helpers with isolated contexts.

## Layers

- **Unit**: mocked I/O — `tests/unit/AGENTS.md`
- **Integration**: DB + in-process MCP / REST Playwright
- **E2E**: browser + built Worker
