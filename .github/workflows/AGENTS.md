# .github/workflows/

CI/CD pipelines.

## Workflows

| Workflow | Trigger | Jobs |
|----------|---------|------|
| CI | push/PR to any branch | Default verification, Worker E2E artifact build, E2E shards |
| DB-backed Bun job | workflow_call | Reusable Postgres-backed Bun job |
| E2E Snapshot Artifacts | push except preview branch, manual | Snapshot capture, artifact upload, screenshot preview publishing, commit comment |
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
- Keep workflow YAML as orchestration. Put reusable or long shell-like snapshot logic in `tools/dev/artifacts/snapshots/snapshot-ci.ts`.
- Never commit secrets
- `copilot-setup-steps.yml` must keep a direct job named exactly `copilot-setup-steps`; inline `runs-on`, `permissions`, `services`, `timeout-minutes`, and `steps` instead of delegating the job through a reusable workflow.
- When changing Copilot setup, run it through `workflow_dispatch` or a PR check. If setup fails, Copilot can still start from the partially prepared environment, so setup logs are part of the verification evidence.

## Common Tasks

```bash
bun install --frozen-lockfile
bun run test
bun run verify       # default gate
bun run verify:full  # expensive gate; needs DATABASE_URL and Playwright
Cloudflare Git integration handles production deploys from the connected branch.
```
