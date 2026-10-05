# .github/workflows/

| Workflow | Trigger | Jobs |
|----------|---------|------|
| CI (`ci.yml`) | manual branch run, push main, PRs | Source checks, application tests/build, database permissions, static-loader image, optional visual snapshots |
| OpenAPI compatibility | PRs | Block breaking changes unless `api-breaking-approved` is present |
| GraphQL compatibility | PRs | Keep the canonical SDL exact and block base incompatibility unless `graphql-breaking-approved` is present |
| DB migrate deploy | `prisma/**` on main, or manual | Production migrate deploy |
| Release | successful CI on main | Tags and GitHub release notes; no main-branch commits |
| Copilot Setup Steps | manual / setup changes | Copilot bootstrap validation |

Scheduled maintenance workflows may also exist for static sync. Treat their
schedules and secret names as operational detail — don't expand them in public
docs.

## Rules

- Align Bun with `.bun-version`; no Node setup steps.
- App-exercising workflows provision their own Postgres + `DATABASE_URL`.
- Production deploy is Cloudflare Git integration only.
- Docker is local infra, CI services, and the static loader image only.
- Declare each CI responsibility directly in `ci.yml`. Shared composite actions only
  install dependencies or prepare test database roles; keep test commands in jobs.
- Only database-backed jobs provision PostgreSQL. Matrix jobs own separate service
  containers; HTTP, browser and visual jobs consume the single `test-build`
  artifact. Build the application, then run `bun run build:test-worker` once;
  `.svelte-kit/test-worker` shares immutable code, never mutable case state.
- PR and manual branch runs use separate ref-based concurrency groups; newer
  runs on the same ref cancel stale work, while main runs are not interrupted.
- Validate an open PR through its automatic current-head run; do not dispatch
  a duplicate manual run after pushing review changes.
- Preserve external job names used by protection. The aggregate gate always runs
  and rejects every non-success mandatory result; specifications run in
  `Source / Checks`.
- Name each business test job `Domain / Method`, for example `Homework / REST`
  or `Catalog / MCP`. A native test has exactly one `@Domain/Method` tag.
  Use the behavior under test as the owner; setup requests and independent
  database observations do not create another verification method.
- `Tests / Inventory` collects native Vitest and Playwright test metadata and
  deduplicates the tags into a matrix. Missing or ambiguous ownership fails the
  inventory. Do not maintain a file-to-job registry, numbered shards, or timing
  scheduler. One combination runs all its applicable engines sequentially.
- Role contracts remain in `Database / Permissions`; visual snapshots remain
  opt-in. Chromium and Mobile Chrome cases share their domain's Web job.
  Playwright uses two native workers; Vitest files remain serial. Keep local
  defaults conservative, private case state, zero test retries and native reports.
  The protected aggregate retains `Specification execution evidence / run`.
- `copilot-setup-steps.yml` must keep a job named exactly `copilot-setup-steps`
  with inline `runs-on` / steps (no reusable-workflow delegation for that job).
