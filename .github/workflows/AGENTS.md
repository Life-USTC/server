# .github/workflows/

| Workflow | Trigger | Jobs |
|----------|---------|------|
| CI (`ci.yml`) | push main, PRs | Check, integration, RLS tests, E2E artifacts/shards, optional visual regression, report publish |
| OpenAPI compatibility | PRs | Block breaking changes unless `api-breaking-approved` is present |
| OpenAPI consumer sync | OpenAPI changes on main, manual | Notify Bot and CLI with the exact server revision |
| DB-backed Bun job | workflow_call | Reusable Postgres-backed Bun job |
| DB migrate deploy | `prisma/**` on main, or manual | Production migrate deploy |
| Release | successful CI on main | Semantic release |
| Copilot Setup Steps | manual / setup changes | Copilot bootstrap validation |

Scheduled maintenance workflows may also exist for static sync. Treat their
schedules and secret names as operational detail — don't expand them in public
docs.

## Rules

- Align Bun with `.bun-version`; no Node setup steps.
- App-exercising workflows provision their own Postgres + `DATABASE_URL`.
- Production deploy is Cloudflare Git integration only.
- Docker is local infra, CI services, and the static loader image only.
- Keep YAML as orchestration; phase command lists live in `db-backed-bun-job.yml`.
  Local check recipes for agents: root `AGENTS.md`.
- E2E HTML publish stays `continue-on-error` with serial artifact concurrency.
- `copilot-setup-steps.yml` must keep a job named exactly `copilot-setup-steps`
  with inline `runs-on` / steps (no reusable-workflow delegation for that job).
