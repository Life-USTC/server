# tests/e2e/

Playwright browser tests against the Cloudflare Worker. Full recipes: root
`AGENTS.md`.

```bash
# First prepare the disposable PostgreSQL service and all connections in root AGENTS.md.
bun run build
bun run build:test-worker
bun run e2e:test   # runs the complete suite once
bunx playwright test path/to/test          # uses the already-prepared schema/roles
```

Application-page and Worker scenarios use native fixtures that start a private
Worker with `wrangler.e2e.jsonc`, a private database clone and separate local R2/KV
state. Harness regressions instead own their local HTTP, process or DOM fixtures.
Global setup validates the four database connections and production role
constraints. The Playwright configuration does not start a shared server or
provide a default origin.

CI names jobs `Domain / Method`, using each test's single native tag such as
`@Homework/Web` or `@Todo/MCP`. Browser configuration does not imply a Web
contract: request-only cases keep their actual protocol. Native collection groups
Chromium and Mobile Chrome by this ownership, without shard numbers or a file
registry. Each combination runs once, including any Vitest/Worker cases with the
same tag.
Each Playwright job uses `--fully-parallel --workers=2`. Locally, build once and use
`bun run e2e:test --workers=2` against the disposable
PostgreSQL service prepared in root `AGENTS.md`. Cases retain private database
clones, Worker ports and persistence directories. Native fixtures release their
resources on test completion, failure and timeout; stop the source container
yourself after the run. Force-killing a runner can bypass teardown and require
manual cleanup of that run's recorded processes and temporary directories.
The shared `.svelte-kit/test-worker` output is immutable compiled code. Rebuild
it after application or Worker fixture changes; every case still starts its own
Worker process with private database and storage state.

CI and local runners invoke Playwright directly. Assertions and runtime failures
are not retried. Native HTML reports, per-test Worker logs, resource identities
and traces remain in `playwright-report/`; CI uploads each job’s output as an
artifact for failure inspection.

Use native failure screenshots and traces for diagnostics. Capture explicit
before/after images when delivering visual changes; ordinary business tests do
not collect optional checkpoint screenshots or custom workflow JSON reports.

The side-effect-free description reads in `description.public-web-personal-overlay`
use Playwright's per-request `maxRetries: 1`. This recovers one `ECONNRESET` transport
failure from a closed pooled connection; it does not retry HTTP errors, test
bodies, or business assertions. Keep it explicit on these reads, never in a
shared request wrapper or blanket GET policy: even a GET such as catalog link
resolution records visits and must not be replayed. Native transport behavior
is covered by `tests/integration/playwright-request-retry.test.ts`.

Fixtures use FUNCTION_OWNER_DATABASE_URL; the Worker uses separate restricted
app/auth/maintenance URLs. The root recipe applies migrations with the owner
connection and then runs the production permission script on a
disposable schema source. It does not seed or reset shared application data.
Invoke Playwright directly against that prepared source.

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
mobile behavior so native workers can execute them independently. Use
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
responses and required persisted effects before completing the workflow. Compiled
Worker modules and source maps are shared read-only. Each case owns its runtime
and storage directory, which the parent removes even when the Worker cannot shut
down gracefully.


Helpers: `gotoAndWaitForReady` and `DEV_SEED` under `utils/`. Authenticated
scenarios arrange a private actor or exercise the real sign-in flow explicitly.

## Conventions

- Prefer role/label selectors; never `waitForTimeout` or `networkidle`.
- Local execution defaults to one worker; CI explicitly uses two workers and
  case-level sharding through native Playwright options.
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
  allowlist. Contrast, link-color, and target-size requirements need dedicated
  observations beyond this structural gate.
- **L3 — capabilities and states:** cover the states a page actually owns. Lists
  exercise results, no-results, filters/search, clear, and pagination when
  present. Forms exercise validation, pending/disabled state, success,
  persistence, and failure/rollback. Dialogs exercise open, focus, Escape,
  cancel, and confirm. Mutating tests create deterministic fixtures, assert the
  UI and persisted effect, and clean up owned state through native fixtures,
  including setup and assertion failures. Dynamic detail pages
  include missing-record/404 cases; role-sensitive pages cover anonymous, user,
  and admin behavior as applicable.
- **L4 — visual evidence:** attach matched before/after screenshots to the PR
  when changing the UI. Test results and failure diagnostics stay in GitHub
  Actions artifacts; do not publish them to a separate repository.

Prefer `getByRole` / bilingual labels. Do not blindly click every button:
destructive, OAuth, download, upload, clipboard, and external-navigation flows
need capability-specific assertions or an explicit inventory exemption. Never
soft-pass an expected control with `if (count() === 0) return`; deterministic
fixtures and `expect(...).toBeVisible()` must make missing UI fail loudly.


## Independent state scenarios

Apply the mutation/consumer split in `tests/AGENTS.md`. Each case owns its required
initial state and can run alone. Updating or removing a record starts with fixture
preparation, not a successful create step earlier in the test. Reuse fixture and
observation helpers without sharing mutable records between cases.

A Web mutation case performs its target operation through the UI and independently
checks persisted effects and the UI response. Consumer cases prepare a known state
and verify actual rendered results; multiple pages may consume that same state.
Include explicit visibility, text, typography and relative layout assertions where
the requirement calls for them; a screenshot or successful navigation alone is not
proof. Verify promised refresh, cache and asynchronous behavior in its owning
module, including an already-open page when required. Do not repeat the same checks
in separate cross-entrypoint or complete-journey layers. Release owned fixtures and
keep tests independent across runner projects.

Generated Playwright tests are ordinary reviewed repository code. Do not derive
business expectations from the current page, runtime YAML or an agent's success
report; retain independently specified expected state and meaningful failure checks.
