# tests/integration/

Integration tests with in-process MCP harness.

## Shared setup

Commands, fixtures, and harness utilities: `tests/AGENTS.md` and the repo root
`AGENTS.md`.

Run integration tests from `$life-ustc-dev-loop`:

```bash
bun run db:migrate:deploy
bunx prisma db seed
bunx vitest run --config vitest.integration.config.ts
bun run rest:test
```

## REST contract tests (`tests/integration/rest/`)

REST-only Playwright specs (no browser) live beside MCP integration tests.
They use `playwright.api.config.ts` and `_harness/auth.ts` for request-based
debug sign-in. Run with `bun run rest:test` (also part of `ci:integration`).

## MCP layout

Tests mirror MCP tool domains (and roughly REST/e2e API groups):

```
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

- `createMcpToolTestContext()` — shared dev-seed user for read-mostly catalog tools.
  Uses the app Prisma singleton via fixtures.
- `createIsolatedMcpToolTestContext()` — throwaway user when a test mutates
  user-owned state, or when `setup` would mutate it (subscriptions, pins,
  preferences, comments, todos, descriptions, homework writes). Optional `setup`
  runs after the user is created.
  Keep the returned context object and read `context.client` / `context.userId` at
  call time — do not destructure, because `beforeAll` assigns those fields later.
- `createSubscribedIsolatedMcpToolTestContext()` — isolated user already subscribed
  to the seed section; exposes `seedSectionId` for fixture creation.
- `deleteIntegrationHomework()` / `deleteIntegrationTodo()` /
  `deleteIntegrationExam(jwId)` — cascade cleanup for rows created in tests.
- `createEphemeralMcpUser()` — throwaway user + MCP harness for a single `it`
  block (e.g. non-owner or suspended-user checks). Call `close()` after any
  test-specific cleanup such as suspensions or comments.
- Non-MCP integration tests should use `createTestPrisma()` from
  `tests/shared/prisma.ts` instead of the MCP fixtures client.

MCP integration tests use isolated contexts for all dev-user mutations; shared
`createMcpToolTestContext()` is read-only. Context factories call
`prisma.$disconnect()` in `afterAll`.

`fileParallelism` is off in `vitest.integration.config.ts`. Turning it on makes
`auth-record-cleanup.test.ts` and `oauth-consent-transaction.test.ts` flaky:
both assert exact whole-table auth row counts, so any concurrent file that
touches sessions or tokens changes the expected total. Scope those assertions
to test-owned rows before re-enabling.

Prefer file-level isolated context when the whole file mutates; use describe-level
isolation when mixing shared read context with write isolation (see
`mcp/community/comments.test.ts`).

## Conventions

- Use `DEV_SEED_ANCHOR` from `tests/fixtures/dev-seed.ts` instead of hardcoded dates.
- Write mutations use unique markers `[integration-test] ...`
- Clean up created data within the test group.
- Read-only seed assertions need no cleanup.
- Pass explicit `userId` into audit helpers when using an isolated context.

## Relationship to other layers

- **Unit**: mocked I/O boundaries, no real DB — see `tests/unit/AGENTS.md`
- **Integration**: DB required, in-process MCP
- **E2E**: browser + built server
