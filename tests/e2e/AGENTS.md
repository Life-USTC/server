# tests/e2e/

Playwright browser tests against the Cloudflare Worker. Full recipes: root
`AGENTS.md`.

```bash
export FUNCTION_OWNER_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/life_ustc_test"
export ALLOW_TEST_DATABASE_SETUP=true
source tests/ci/setup-runtime-database.sh
bun run e2e:test   # prepares schema/roles once and runs all eight native shards
bunx playwright test path/to/test          # uses the already-prepared schema/roles
CAPTURE_STEP_SCREENSHOTS=1 bunx playwright test path/to/test
```

Each test's native fixture starts a private Worker using `wrangler.e2e.jsonc`,
a private database clone and separate local R2/KV state. Global setup validates
the four database connections and production role constraints. The Playwright
configuration does not start a shared server or provide a default origin.

CI uses eight browser shards. The local parallel runner executes the same eight
partitions with `E2E_CONCURRENCY=2` by default; set it from 1 through 8 to fit
available memory. Every partition retains its own PostgreSQL service and reports.
Individual cases own ephemeral Worker ports and persistence directories.

CI and shard scripts run `tests/ci/e2e-run-shard.sh`, which executes the requested
native partition once and preserves its exit status. Assertions and runtime
failures are not retried. Per-test Worker logs, resource identities and native
traces remain in `playwright-report/` for cleanup and failure inspection.

The side-effect-free description reads in `description.public-web-personal-overlay`
use Playwright's per-request `maxRetries: 1`. This recovers one `ECONNRESET` transport
failure from a closed pooled connection; it does not retry HTTP errors, test
bodies, or business assertions. Keep it explicit on these reads, never in a
shared request wrapper or blanket GET policy: even a GET such as catalog link
resolution records visits and must not be replayed. Native transport behavior
is covered by `tests/integration/playwright-request-retry.test.ts`.

Fixtures use FUNCTION_OWNER_DATABASE_URL; the Worker uses separate restricted
app/auth/maintenance URLs. `setup-runtime-database.sh` requires the explicit
`ALLOW_TEST_DATABASE_SETUP=true` opt-in and applies migrations plus the production
permission script to a disposable schema source. It does not seed or reset shared
application data. Invoke Playwright directly against an already-prepared source
to keep setup separate from test execution.

## Scenario data

`tests/e2e/fixtures/scenario.json` and `tests/fixtures/dev-seed.ts` supply explicit
values to private fixtures. Development seeding remains available through
`ALLOW_DATABASE_SEED=true bunx prisma db seed`; it is not test setup.

## Layout

```text
tests/e2e/fixtures/             scenario.json
tests/e2e/src/app/**/test.ts    Browser scenarios (may span routes)
tests/e2e/src/app/workspace/**  Covers /workspace/* UI
tests/e2e/utils/                Auth, DB, subscriptions, uploads
tests/integration/rest/         REST contracts — not browser E2E
```

Mobile route checks are split by public, authenticated, and admin access.
Workspace homework checks are split by creation, completion, list state, and
mobile behavior so file-based shards can distribute them independently. Use
test-scoped accounts and domain fixtures for mutable data. Global activation and
maintenance scenarios require their own database/service environment. Use the native
`test` export from `utils/isolated-worker.ts` for these cases. It clones an empty
schema with the source roles/grants/RLS, starts a private real Worker with the
existing E2E bindings and separate persistence, and sets native page/request
`baseURL`. Arrange data through `isolatedWorker.database.owner`; create private
sessions with `isolatedWorker.createActor()` and add its cookie to the page.
No seeded rows are copied. The Worker receives only restricted database URLs.
Teardown closes request contexts and the Worker process before dropping the
private database and storage. Logs and resource identities are retained in the
test output for failure cleanup checks. This fixture requires the same matching
PostgreSQL client and database-create privilege as `isolatedDatabaseTest`;
stateful tests should own their Worker even when they use a private account.
A private account on a shared Worker does not isolate deferred work or queues.
Anonymous checks also use private fixtures; no case falls back to a shared server.

Use `utils/owned-worker.ts` to own complete asynchronous preparation, request and
observation callbacks with `run()`. Browser workflow fixtures must also depend on
the native `page` fixture and wait for the complete workflow before releasing it;
request ownership alone does not keep a page alive. Observe actual UI write
responses and required persisted effects before completing the workflow. Worker
bundles and storage belong to the private temporary directory, which the parent
removes even when the Worker cannot shut down gracefully.


Helpers: `gotoAndWaitForReady` and `DEV_SEED` under `utils/`. Authenticated
scenarios arrange a private actor or exercise the real sign-in flow explicitly.

## Conventions

- Prefer role/label selectors; never `waitForTimeout` or `networkidle`.
- The complete suite defaults to one worker per shard to bound resource use.
  Validate fixture changes standalone, reordered and with multiple workers
  sharing a schema source. Do not introduce
  serial blocks or shared-user restore logic as a new isolation mechanism.


## Unified UI contract (L0-L4)

- **L0 — inventory:** `tests/e2e/src/app/_shared/page-inventory.ts` lists every
  `src/routes/**/+page.svelte` and supplies concrete browser samples and mobile
  batches. Route completeness is a structural check, not proof of coverage.
  Review requirements and supporting desktop/mobile scenarios manually; never
  infer execution from helper names, source fragments or test-owner entries.
- **L1 — rendered page baseline:** scenarios exercise their relevant pages on
  desktop and mobile. Use explicit observations or shared observation helpers
  with an independently prepared account. A dedicated test per page is not
  required. Require a successful document response,
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
  UI and persisted effect, and clean up owned state through native fixtures,
  including setup and assertion failures. Dynamic detail pages
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


## State and journey scenarios

Apply the mutation/consumer/connection split in `tests/AGENTS.md`. Group checks by
business state or journey when they share a meaningful scenario; visiting multiple
pages is useful when checking their projections of the same state. Keep independent
permission and failure branches separate instead of building one enormous journey.

A Web mutation test must perform the target operation through the UI. Preparing
unrelated prerequisites through an isolated fixture adapter is allowed. Consumer
tests prepare state independently and verify actual rendered results. Include
explicit visibility, text, typography and relative layout assertions where the
requirement calls for them; a screenshot or a successful navigation alone is not
proof. A fresh-load consumer does not replace checks of an already-open page after
mutation. Restore owned fixtures and keep tests independent across runner projects.

Generated Playwright tests are ordinary reviewed repository code. Do not derive
business expectations from the current page, runtime YAML or an agent's success
report; retain independently specified expected state and meaningful failure checks.
