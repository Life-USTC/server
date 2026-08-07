# .github/workflows/

| Workflow | Trigger | Jobs |
|----------|---------|------|
| CI | push main, PRs | Default checks, MCP integration, Worker E2E artifact, E2E shards |
| DB-backed Bun job | workflow_call | Reusable Postgres-backed Bun job |
| DB migrate deploy | `prisma/**` on main, or manual | Production migrate deploy |
| Auth Record Cleanup | every 6h, manual | Bounded expired auth-record cleanup |
| Static sync | scheduled / manual | Pull static SQLite into loader flow |
| Upload pending cleanup | scheduled / manual | Pending upload garbage collection |
| Copilot Setup Steps | manual / setup changes | Copilot bootstrap validation |
| Release | successful CI on main | Semantic release |

## Rules

- Align Bun with `.bun-version`; no Node setup steps.
- App-exercising workflows provision their own Postgres + `DATABASE_URL`. Upload
  storage uses R2 bindings; do not add MinIO unless testing object storage.
- Production deploy is Cloudflare Git integration only — no repo deploy jobs.
- Docker is local infra, CI services, and the static loader image only.
- Keep YAML as orchestration; sequences live in `$life-ustc-dev-loop`.
- E2E HTML publish stays `continue-on-error` with serial artifact concurrency.
- `copilot-setup-steps.yml` must keep a job named exactly `copilot-setup-steps`
  with inline `runs-on` / steps (no reusable-workflow delegation for that job).
