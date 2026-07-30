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

## Environment

CI sets `DATABASE_URL`, seeds data, and runs migrations before E2E. For local runs, use the same `.env` values documented in the root README and ensure migrations are applied.

## Reporting

Failed CI shards upload Playwright HTML reports. Merge them via the `Publish E2E HTML report` workflow when debugging shard-only failures.
