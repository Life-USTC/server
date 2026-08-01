# End-to-end tests

Playwright specs live under `tests/e2e/src`. CI runs them in four shards to stay within job time limits.

## Match CI locally

Prerequisites:

- PostgreSQL available at `DATABASE_URL` (see root README)
- Migrations applied at least once
- `ALLOW_DATABASE_SEED=true` in your environment

Start from a clean database when validating the complete suite:

```bash
bun run app:prepare
bun run db:migrate:deploy
ALLOW_DATABASE_SEED=true bunx prisma db seed
ALLOW_DATABASE_SEED=true bun run build
ALLOW_DATABASE_SEED=true bun run e2e:test
```

`bun run e2e:test` is the canonical full-suite command. It runs the same four shards as GitHub Actions and **reseeds the database before each shard**, which matches CI's per-job lifecycle. A single unsharded `bunx playwright test` reuses one seed across all files and projects; several specs mutate the shared debug user, todos, OAuth clients, and homework fixtures, so that command is not equivalent to CI and may fail even when all shards pass.

Run one shard manually (same as CI `E2E_SHARD=current/total`):

```bash
bun run app:prepare
bun run db:migrate:deploy
ALLOW_DATABASE_SEED=true bunx prisma db seed
bunx playwright test --shard=1/4
bunx playwright test --shard=2/4
bunx playwright test --shard=3/4
bunx playwright test --shard=4/4
```

Or use the package aliases:

```bash
bun run e2e:test:shard1
bun run e2e:test:shard2
bun run e2e:test:shard3
bun run e2e:test:shard4
```

For a focused local run after setup, `bunx playwright test <path>` is fine. Playwright starts the E2E server automatically via `bun run e2e:server` unless you start it yourself in another terminal.

## Visual regression matrix

Committed Playwright screenshot baselines live under `tests/e2e/visual-matrix/snapshots/`. They cover three critical screens across locale (`zh-cn`, `en-us`), light theme, and two viewports (mobile `390x844`, desktop `1280x720`):

- Shell home (`/`)
- Catalog course list (`/catalog/courses`)
- Workspace overview (`/workspace/overview`, signed-in debug user)

The matrix is **opt-in** so default CI stays fast:

| Context | How to run |
| --- | --- |
| Local update | `bun run build && bun run e2e:visual:update` |
| Local verify | `bun run build && bun run e2e:visual` |
| CI check phase | Set repository variable `VISUAL_REGRESSION=1` to enable the `Visual regression (opt-in)` job, or export `VISUAL_REGRESSION=1` when invoking `ci:verify` with Playwright installed |
| Default E2E shards | Skipped (`VISUAL_REGRESSION` unset) |

Tradeoff: pixel baselines catch real UI regressions but add maintenance cost (update snapshots on intentional design changes) and roughly double Playwright runtime when enabled. Keeping them opt-in avoids blocking every PR on screenshot drift while the baseline set is still small.

Deterministic setup uses `NEXT_LOCALE` cookies, `life-ustc-theme=light` in `localStorage`, a fixed overview week (`overviewWeek=2026-04-26`), and `DEV_SEED_ANCHOR` clock pinning for signed-in overview content.

## Environment

CI sets `DATABASE_URL`, seeds data, and runs migrations before each E2E shard. For local runs, use the same `.env` values documented in the root README and ensure migrations are applied.

## Reporting

- Per-shard HTML reports (local full suite): `playwright-report/html/`
- Per-shard raw results: `playwright-report/e2e-results/`
- CI uploads blob reports per shard; merge them via the `Publish E2E HTML report` workflow when debugging shard-only failures.

Remove local `playwright-report/` output before committing unless you are attaching artifacts for debugging.
