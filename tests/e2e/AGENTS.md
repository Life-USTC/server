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

CI and shard scripts run `tests/ci/e2e-run-shard.sh`, which allows one bounded
retry only after `tests/ci/e2e-worker-server.sh` records a startup failure,
health failure, or child-process exit. Individual Playwright assertions are
not retried. Wrangler output, child status, and health probes are retained
under `playwright-report/worker/` for CI artifact inspection.

The seed SQL is deliberately conflict-tolerant and preserves unrelated local
rows, so it is not a complete reset after a partially executed shard. Before
the bounded retry, CI therefore runs `prisma migrate reset --force` against
its disposable PostgreSQL service, then explicitly runs the configured seed.
Local retries keep the non-destructive migrate-and-seed path and never drop a
developer database.

## Seed

`tests/e2e/fixtures/scenario.json` and `tests/fixtures/dev-seed.ts` share fixture
data; `prisma/seed.sql` is what the DB load uses. Keep them aligned when you
change scenarios.

## Layout

```text
tests/e2e/fixtures/             scenario.json
tests/e2e/src/app/**/test.ts    Route tests (browser UI)
tests/e2e/src/app/workspace/**  Covers /workspace/* UI
tests/e2e/utils/                Auth, DB, subscriptions, uploads
tests/integration/rest/         REST contracts — not browser E2E
```

Helpers: `signInAsDebugUser`, `gotoAndWaitForReady`, `DEV_SEED` under `utils/`.

## Conventions

- Prefer role/label selectors; never `waitForTimeout` or `networkidle`.
- One worker per shard; shared-state files use
  `test.describe.configure({ mode: "serial" })` and restore seed in `finally`
  (e.g. `tests/e2e/src/app/test.ts`, welcome/settings, `workspace/**`, MCP UI).


## Unified UI contract (L0-L4)

- **L0 — inventory:** `tests/e2e/src/app/_shared/page-inventory.ts` lists every
  `src/routes/**/+page.svelte`, redirect, and non-page browser alias. The unit
  gate fails when a route is orphaned. Every rendered page also owns exactly
  one mobile contract: inventory-driven public/authed/admin coverage, or a
  dedicated scenario with a spec, test name, and non-empty reason.
- **L1 — rendered page baseline:** every page calls `assertPageContract` and is
  exercised on desktop and mobile. Require a successful document response,
  final URL/title/language, one visible main content target, a visible level-one
  heading, meaningful settled content, no runtime/console error or error
  overlay, and no document-level horizontal overflow.
- **L2 — UI quality and required elements:** reject duplicate IDs, broken
  visible images, empty headings, unsafe/missing link destinations, and serious
  or critical structural WCAG A/AA violations. Page specs assert their required
  controls with role/label locators. Third-party exceptions must be scoped by
  issue kind and exact match, and must include a reason; never add a wildcard
  allowlist. Contrast, link-color, target-size, and pixel-diff checks are visual
  policy and stay outside the no-visual-change structural gate.
- **L3 — capabilities and states:** cover the states a page actually owns. Lists
  exercise results, no-results, filters/search, clear, and pagination when
  present. Forms exercise validation, pending/disabled state, success,
  persistence, and failure/rollback. Dialogs exercise open, focus, Escape,
  cancel, and confirm. Mutating tests create deterministic fixtures, assert the
  UI and persisted effect, and restore state in `finally`. Dynamic detail pages
  include missing-record/404 cases; role-sensitive pages cover anonymous, user,
  and admin behavior as applicable.
- **L4 — visual evidence:** keep pixel regression opt-in and representative
  across the shell, a public catalog surface, and an authenticated workspace in
  both locales and viewports. Do not require pixel snapshots for every page.

Prefer `getByRole` / bilingual labels. Do not blindly click every button:
destructive, OAuth, download, upload, clipboard, and external-navigation flows
need capability-specific assertions or an explicit inventory exemption. Never
soft-pass an expected control with `if (count() === 0) return`; deterministic
fixtures and `expect(...).toBeVisible()` must make missing UI fail loudly.
