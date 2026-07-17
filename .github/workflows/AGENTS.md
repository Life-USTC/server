# .github/workflows/

CI/CD pipelines.

## Workflows

| Workflow | Trigger | Jobs |
|----------|---------|------|
| CI | push to main, PR to any branch | Default verification, MCP integration, Worker E2E artifact build, E2E shards |
| DB-backed Bun job | workflow_call | Reusable Postgres-backed Bun job |
| DB migrate deploy | successful CI completion on main, or manual | Production Prisma migrate deploy |
| Recovery Drill Verify | manual | Isolated restore migration and aggregate integrity verification |
| Copilot Setup Steps | manual or setup workflow changes | Copilot bootstrap validation |
| Release | successful CI completion on main | Semantic release |

## Version Alignment

Keep Bun versions aligned with:
- `.bun-version`

## Rules

- Use repo's `bun`-based commands; do not add Node setup steps
- Workflows that exercise app code should provision their own Postgres service and set `DATABASE_URL` explicitly. Upload storage uses Cloudflare R2 bindings in Worker flows; do not add MinIO/S3 emulation to CI unless a test explicitly covers object storage behavior.
- Production deploy is owned by Cloudflare's Git integration; do not add repo-managed deploy jobs.
- Docker is only for local infra, CI service containers, and the static loader image; do not add app-serving Docker jobs.
- Keep workflow YAML as orchestration. Reusable check, test, and seed sequences live in `$life-ustc-dev-loop`.
- Never commit secrets
- Production database writers share the `production-database-writes` concurrency group with `queue: max`, retaining up to 100 pending runs in FIFO order, and bind the externally protected `production` environment.
- Recovery drills use the separate `database-recovery` environment and only its ephemeral isolated-database secrets. They do not prove provider backup or PITR configuration; follow `docs/runbooks/database-recovery.md`.
- `copilot-setup-steps.yml` must keep a direct job named exactly `copilot-setup-steps`; inline `runs-on`, `permissions`, `services`, `timeout-minutes`, and `steps` instead of delegating the job through a reusable workflow.
- When changing Copilot setup, run it through `workflow_dispatch` or a PR check. If setup fails, Copilot can still start from the partially prepared environment, so setup logs are part of the verification evidence.

## Common Tasks

```bash
bun install --frozen-lockfile
bunx biome check
bunx vitest run
```

For full check, integration, E2E, and handoff sequences, use `$life-ustc-dev-loop`.
Cloudflare Git integration handles production deploys from the connected branch.
