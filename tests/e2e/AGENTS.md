# tests/e2e/

Playwright browser tests. Use `$life-ustc-dev-loop` for the canonical E2E
sequence (`bun run e2e:test` = sharded CI parity). Focused local runs:

```bash
bunx playwright test path/to/test
bunx playwright test --headed path/to/test
CAPTURE_STEP_SCREENSHOTS=1 bunx playwright test path/to/test
```

## Caveats

- Playwright starts the Worker via `bun run e2e:server` (`wrangler.e2e.jsonc`) on
  `localhost:3000` — free that port first. R2 comes from local `R2_UPLOADS`.
- Seed edits: `tests/e2e/fixtures/scenario.json` → `prisma/seed.sql` →
  `tests/fixtures/dev-seed.ts` (see root Shared Test Seed).
- Prefer role/label selectors; never `waitForTimeout` or `networkidle`.
- Full suite is four sequential shards with reseed; do not treat a single
  unsharded `playwright test` as a release gate.
- One worker per shard; shared-state files use `test.describe.configure({ mode: "serial" })`
  (e.g. `tests/e2e/src/app/test.ts`, welcome/settings, `dashboard/**`, MCP UI).
  Restore seeded state in `finally` when adding new shared-state files.

Helpers: `signInAsDebugUser`, `gotoAndWaitForReady`, `DEV_SEED` under `utils/`.
REST contract tests live in `tests/integration/rest/` (`playwright.api.config.ts`).
