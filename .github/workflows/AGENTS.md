# .github/workflows/

CI/CD pipelines.

## Workflows

| Workflow | Trigger | Jobs |
|----------|---------|------|
| CI | push/PR to main | Check, E2E (4 shards), Commitlint |
| CD | push to main | Cloudflare Deploy |
| Release | push to main | Changelog + version bump |
| Code Quality | push to main | Biome check |

## Version Alignment

Keep Bun versions aligned with:
- `.bun-version`

## Rules

- Use repo's `bun`-based commands; do not add Node setup steps
- Production deploy: `bun run deploy:cloudflare`
- Docker is only for local infra and the static loader image; do not add app-serving Docker jobs.
- Never commit secrets
- `copilot-setup-steps.yml` must keep a direct job named exactly `copilot-setup-steps`; inline `runs-on`, `permissions`, `services`, `timeout-minutes`, and `steps` instead of delegating the job through a reusable workflow.
- When changing Copilot setup, run it through `workflow_dispatch` or a PR check. If setup fails, Copilot can still start from the partially prepared environment, so setup logs are part of the verification evidence.

## Common Tasks

```bash
bun install --frozen-lockfile
bun run check
bun run typecheck
bun run test
bun run test:integration  # needs DATABASE_URL
bun run test:e2e          # needs build
bun run deploy:cloudflare
```
