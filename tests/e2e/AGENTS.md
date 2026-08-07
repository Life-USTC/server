# tests/e2e/

Playwright browser tests against the Cloudflare Worker. Full command recipes:
root `AGENTS.md` Commands.

```bash
bun run e2e:test                          # CI parity (four shards + reseed)
bunx playwright test path/to/test         # focused (free localhost:3000 first)
CAPTURE_STEP_SCREENSHOTS=1 bunx playwright test path/to/test
```

Playwright starts the Worker via `bun run e2e:server` (`wrangler.e2e.jsonc`).
R2 uses local `R2_UPLOADS`.

## Seed

`tests/e2e/fixtures/scenario.json` → `prisma/seed.sql` →
`tests/fixtures/dev-seed.ts` (root `AGENTS.md`).

## Layout

```text
tests/e2e/fixtures/             scenario.json
tests/e2e/src/app/**/test.ts    Route tests (browser UI)
tests/e2e/src/app/dashboard/**  Covers /workspace/* UI (feature still named dashboard)
tests/e2e/utils/                Auth, DB, subscriptions, uploads
tests/integration/rest/         REST contracts — not browser E2E
```

Helpers: `signInAsDebugUser`, `gotoAndWaitForReady`, `DEV_SEED` under `utils/`.

## Conventions

- Prefer role/label selectors; never `waitForTimeout` or `networkidle`.
- One worker per shard; shared-state files use
  `test.describe.configure({ mode: "serial" })` and restore seed in `finally`
  (e.g. `tests/e2e/src/app/test.ts`, welcome/settings, `dashboard/**`, MCP UI).
