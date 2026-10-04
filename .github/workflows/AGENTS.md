# .github/workflows/

| Workflow | Trigger | Jobs |
|----------|---------|------|
| CI (`ci.yml`) | manual branch run, push main, PRs | Check, integration, RLS tests, E2E artifacts/shards, optional visual regression |
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
  and rejects every non-success mandatory result; specifications run in Check.
- Browser jobs upload native HTML reports and failure diagnostics as CI artifacts.
- CI groups tests by engine and browser project: Integration, HTTP, Chromium,
  and Mobile Chrome. HTTP/browser jobs use native case sharding and two workers;
  HTTP runs at most four shards at once to leave runner capacity for longer
  browser jobs. Keep local defaults conservative and visual projects opt-in. Do not maintain
  a separate file-to-shard registry or scheduler.
- `copilot-setup-steps.yml` must keep a job named exactly `copilot-setup-steps`
  with inline `runs-on` / steps (no reusable-workflow delegation for that job).
