# tests/e2e/

Playwright browser tests.

## Commands

Use the root `AGENTS.md` command list for the canonical E2E workflow. For a
focused local Playwright run, prepare the Worker runtime and seed data first:

```bash
bun run build
bun --silent run e2e:prepare
bun run seed
bunx playwright test --headed path/to/test
bunx playwright test --ui
```

## Local Setup

Use the root `AGENTS.md` for the shared setup flow. E2E-only caveats:

- Package scripts build the Cloudflare Worker bundle before Playwright starts.
- Playwright starts the local Worker with `bun run tools/dev/e2e.ts start`, which runs `wrangler dev` with proxy variables cleared for localhost.
- Playwright global setup validates the database environment only; R2 is provided by Wrangler's local `R2_UPLOADS` binding.

## Test Data

Use the repo root `AGENTS.md` for the canonical shared seed/setup flow and
`DEV_SEED_ANCHOR` guidance. E2E-specific fixture edits still follow this path:

- Update `tests/e2e/fixtures/scenario.json`
- Update `tools/dev/seed/seed-dev-scenarios.ts` if new entities must be created
- Update `tools/dev/seed/dev-seed.ts` when tests need a named export

## Structure

```
tests/e2e/fixtures/             Canonical test data (scenario.json)
tests/e2e/src/app/**/test.ts    Route tests
tests/e2e/src/app/_shared/      Helpers
tests/e2e/utils/                Auth, DB, subscriptions, uploads
```

## Helpers

```typescript
import { signInAsDebugUser, signInAsDevAdmin } from "../utils/auth";
import { expectRequiresSignIn } from "../utils/auth";
import { gotoAndWaitForReady } from "../utils/page-ready";
import { DEV_SEED } from "../utils/dev-seed";
```

## Test Shape

1. Route contract (loads, no 500, expected shell)
2. Behavior tests for user journeys
3. One test = one user story
4. Idempotent across repeated runs
5. Clean up created data

## Selectors

```typescript
// Prefer
page.getByRole("button", { name: "Submit" })
page.getByLabel("Email")
page.getByText("Welcome")

// Avoid
page.locator(".class") // brittle
```

## Flake Prevention

```typescript
// DO
await page.waitForResponse(url);
await expect(page).toHaveURL(/expected/);
await expect(element).toBeVisible();

// DON'T
await page.waitForTimeout(1000); // ❌ rejected by tools/dev/check.ts e2e
```

## Concurrency

The canonical Playwright run uses one worker because multiple files mutate the
same seeded debug user. Files with shared-state mutations also use
`test.describe.configure({ mode: "serial" })` to make the dependency explicit.
Current examples:

- `tests/e2e/src/app/test.ts`
- `tests/e2e/src/app/welcome/test.ts`
- `tests/e2e/src/app/settings/profile/test.ts`
- `tests/e2e/src/app/dashboard/homeworks/test.ts`
- `tests/e2e/src/app/dashboard/subscriptions/sections/test.ts`
- `tests/e2e/src/app/teachers/[id]/test.ts`
- `tests/e2e/src/app/api/calendar-subscriptions/test.ts`
- `tests/e2e/src/app/api/calendar-subscriptions/current/test.ts`
- `tests/e2e/src/app/api/users/[userId]/calendar.ics/test.ts`
- `tests/e2e/src/app/api/mcp/test.ts`

If you add a shared-state mutating test to a new file, add serial mode and
restore the original seeded state in `finally`.

## Coverage Priorities

- Permissions (anon, user, admin distinct)
- Subscription not enrollment
- Homework vs completion separation
- Upload authorization
