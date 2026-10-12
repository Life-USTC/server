# .github/workflows/

| Workflow | Trigger | Jobs |
|----------|---------|------|
| CI (`ci.yml`) | manual branch run, push main, PRs | Source checks, application tests/build, database permissions, static-loader image |
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
- Let Actions own service containers and job results, and native runners own tests.
  Keep assertions in test files; do not embed JavaScript in shell/YAML or add local
  launchers, environment-conversion scripts, or wrapper-specific self-tests.
- Only database-backed jobs provision PostgreSQL. Matrix jobs own separate service
  containers; HTTP and browser jobs consume the single `test-build`
  artifact. Build the application, then run `bun run build:test-worker` once;
  `.svelte-kit/test-worker` shares immutable code, never mutable case state.
- PR and manual branch runs use separate ref-based concurrency groups; newer
  runs on the same ref cancel stale work, while main runs are not interrupted.
- Validate an open PR through its automatic current-head run; do not dispatch
  a duplicate manual run after pushing review changes.
- Preserve external job names used by protection. The aggregate gate always runs
  and rejects every non-success mandatory result; specifications run in
  `Checks`.
- A native test has exactly one `@Domain/Method` tag, for example
  `@Homework/REST` or `@Course/MCP`. One job covers one feature and is named
  after it, such as `Homework`.
  Use the behavior under test as the owner; setup requests and independent
  database observations do not create another verification method.
  Use concrete features rather than the `catalog` route/directory umbrella:
  Course, Section, Teacher, Schedule, Semester and RoomMap. CatalogMetadata
  owns the combined filter dictionaries. Related projections stay with their
  consumer; shared templates and individual dictionary tables are not domains.
- `Build` collects native Vitest and Playwright test metadata and groups the
  tags by feature, because it already prepares everything that collection
  needs; the feature jobs read the matrix from it rather than from a job of
  their own. Missing or ambiguous ownership fails the
  inventory. Features are listed longest first, because GitHub hands out
  runners in that order and a run ends when the last job to start finishes.
  The matrix stays derived from the inventory: do not maintain a file-to-job
  registry, numbered shards, or recorded timings. A feature runs all its
  applicable engines sequentially, in exactly one job.
- Role contracts remain in `Permissions`. Chromium and Mobile Chrome
  cases share their domain's Web job.
  Playwright uses two native workers; Vitest files remain serial. Four workers
  were measured and made browser jobs flaky: the runner has four
  vCPUs, and every case already owns a Worker and a database, so the suite's
  short default timeouts started expiring under the contention. Keep local
  defaults conservative, private case state, zero test retries and native reports.
  The protected aggregate retains `Specification execution evidence / run`.
- `copilot-setup-steps.yml` must keep a job named exactly `copilot-setup-steps`
  with inline `runs-on` / steps (no reusable-workflow delegation for that job).
