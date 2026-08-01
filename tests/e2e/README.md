# End-to-end tests

Playwright specs live under `tests/e2e/src`. CI runs them in four shards to stay within job time limits.

## Match CI locally

Start the E2E worker (in a separate terminal):

```bash
bun run e2e:server
```

Run one shard (same as CI `E2E_SHARD=current/total`):

```bash
bunx playwright test --shard=1/4
bunx playwright test --shard=2/4
bunx playwright test --shard=3/4
bunx playwright test --shard=4/4
```

Run the full suite sequentially (slower, closer to a release smoke check):

```bash
bun run e2e:test
```

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

CI sets `DATABASE_URL`, seeds data, and runs migrations before E2E. For local runs, use the same `.env` values documented in the root README and ensure migrations are applied.

## Reporting

Failed CI shards upload Playwright HTML reports. Merge them via the `Publish E2E HTML report` workflow when debugging shard-only failures.
