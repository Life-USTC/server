# .github/workflows/

| Workflow | Trigger | Jobs |
|----------|---------|------|
| CI (`ci.yml`) | manual branch run, push main, PRs | Check, integration, RLS tests, E2E artifacts/shards, optional visual regression |
| OpenAPI compatibility | PRs | Block breaking changes unless `api-breaking-approved` is present |
| GraphQL compatibility | PRs | Keep the canonical SDL exact and block base incompatibility unless `graphql-breaking-approved` is present |
| Bun job | workflow_call | Reusable non-DB Bun job for static checks, unit coverage, and builds |
| DB-backed Bun job | workflow_call | Reusable Postgres-backed Bun job |
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
- Keep YAML as orchestration; pure phase command lists live in `bun-job.yml` and
  database-backed phase command lists live in `db-backed-bun-job.yml`.
- Pure static, unit, and build jobs must use `bun-job.yml`; only app-exercising
  jobs should provision the Postgres service from `db-backed-bun-job.yml`.
  Local check recipes for agents: root `AGENTS.md`.
- Browser jobs upload native HTML reports and failure diagnostics as CI artifacts.
- `copilot-setup-steps.yml` must keep a job named exactly `copilot-setup-steps`
  with inline `runs-on` / steps (no reusable-workflow delegation for that job).
