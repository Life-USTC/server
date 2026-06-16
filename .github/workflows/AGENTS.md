# .github/workflows/

CI/CD pipelines.

## Workflows

| Workflow | Trigger | Jobs |
|----------|---------|------|
| CI | push/PR to any branch | Default verification, Worker E2E artifact build, E2E shards |
| DB-backed Bun job | workflow_call | Reusable Postgres + MinIO Bun job |
| E2E Snapshot Artifacts | push except preview branch, manual | Snapshot capture, artifact upload, screenshot preview publishing, commit comment |
| Copilot Setup Steps | manual or setup workflow changes | Copilot bootstrap validation |
| Release | push to main | Semantic release |

## Version Alignment

Keep Bun versions aligned with:
- `.bun-version`

## Rules

- Use repo's `bun`-based commands; do not add Node setup steps
- Workflows that exercise app code should provision their own Postgres and MinIO services and set `DATABASE_URL`, `S3_BUCKET`, `AWS_REGION`, `AWS_DEFAULT_REGION`, `AWS_ENDPOINT_URL_S3`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY` explicitly.
- Production deploy is owned by Cloudflare's Git integration; do not add repo-managed deploy jobs.
- Docker is only for local infra, CI service containers, and the static loader image; do not add app-serving Docker jobs.
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
