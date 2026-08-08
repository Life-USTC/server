# tests/e2e/

Playwright browser tests against the Cloudflare Worker. Full recipes: root
`AGENTS.md`.

```bash
ALLOW_DATABASE_SEED=true bun run e2e:test   # CI parity (four shards + reseed)
bunx playwright test path/to/test          # focused (free localhost:3000 first)
CAPTURE_STEP_SCREENSHOTS=1 bunx playwright test path/to/test
```

Playwright starts the Worker via `bun run e2e:server` (`wrangler.e2e.jsonc`).
R2 uses local `R2_UPLOADS`.

## Seed

`tests/e2e/fixtures/scenario.json` and `tests/fixtures/dev-seed.ts` share fixture
data; `prisma/seed.sql` is what the DB load uses. Keep them aligned when you
change scenarios.

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


## Page inventory (L0 / L1 / L2)

- **L0 — inventory gate:** `tests/e2e/src/app/_shared/page-inventory.ts` lists every
  `src/routes/**/+page.svelte`. `tests/unit/page-inventory.test.ts` fails if a
  new page is orphaned or a `primaryActions` entry lacks a spec / exemption.
- **L1 — page identity:** call `assertPageContract` from the page’s
  `tests/e2e/src/app/**/test.ts` (reuse `gotoAndWaitForReady` / role labels).
- **L2 — primary actions:** each actionable control that changes state or
  navigates needs a role/label case in the page spec, **or** an inventory
  exemption: `decorative` | `live-oauth` | `covered-by:<spec>`.
- Prefer `getByRole` / bilingual labels. Do not soft-skip expected product
  controls with `test.skip` when `count() === 0` — use `expect(...).toBeVisible()`.
- Mobile screenshot paths come from `mobileScreenshotPaths()` in the inventory.
