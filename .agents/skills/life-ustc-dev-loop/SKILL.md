---
name: life-ustc-dev-loop
description: "Single source of truth for the entire Life@USTC development loop: setup, checks, tests, verification, and handoff to PR workflow."
---

# Life@USTC Dev Loop

This skill records the canonical order of commands for developing, checking, and shipping changes in the Life@USTC server repo. No TypeScript orchestrates these commands; they are run directly from the shell or dispatched through subagents.

## Core constraints

- TypeScript in `src/` contains only application/domain logic.
- Native module usage (`node:*`, `bun:*`, `process`, `fs`, etc.) lives only in `src/lib/adapters/`.
- Domain code imports only from `src/lib/ports/`.
- `package.json` contains only core build/dev aliases. Verification, test, check, and link commands live in this skill.

## 1. Start dev environment

```bash
docker compose -f docker-compose.dev.yml up -d
bun run app:prepare
bun run db:migrate:deploy
bunx prisma db seed
bun run dev
```

The dev server is hardcoded to `http://127.0.0.1:3000`. Do not override ports or proxies locally.

## 2. Make changes

- Domain logic goes in `src/features/` and `src/routes/`.
- Runtime concerns go behind `src/lib/ports/`; implementations go in `src/lib/adapters/`.
- Do not add new TypeScript scripts, checkers, or harnesses.

## 3. Run checks — dispatch a subagent

For any non-trivial change, dispatch a subagent to run the full check sequence and report pass/fail for each step:

```bash
bun run app:prepare
bunx biome check
bunx svelte-check --tsconfig ./tsconfig.json
bunx tsc --noEmit -p tsconfig.typecheck.json
bunx tsc --noEmit -p tsconfig.typecheck.tests.json
bunx tsc --noEmit -p tsconfig.typecheck.operational.json
bunx vitest run
```

The subagent should:
1. Run each command in order.
2. Stop on first failure and report the failing command and error.
3. On success, report which commands passed.

## 4. Run integration tests — dispatch a subagent

```bash
bun run db:migrate:deploy
bunx prisma db seed
bunx vitest run --config vitest.integration.config.ts
```

## 5. Run E2E tests — dispatch a subagent

```bash
bun run db:migrate:deploy
bunx prisma db seed
bun run app:prepare
bun run build
bunx playwright test
```

Playwright starts the E2E server automatically via `bun run e2e:server`.

## 6. Manual checklist before PR

Scripts cannot check these; review them yourself or include them in the subagent handoff:

- Updated `docs/contracts/*.json` if behavior, permissions, or workflow changed.
- Checked REST/MCP parity when one public surface changed.
- Checked seeded test coverage for the changed behavior.
- No `node:*`, `bun:*`, `fs`, `path`, `child_process`, or `process` imports outside `src/lib/adapters/`.
- No new TypeScript scripts or command orchestration added.

## 7. UI verification — dispatch a subagent

For user-visible changes (pages, components, CSS, responsive layout, copy, navigation):

1. Identify the smallest screen or journey that exercises the change.
2. Run the E2E flow above with a focused path:
   ```bash
   bunx playwright test <path>
   ```
3. Inspect a screenshot, headed run, or trace for the affected area.
4. Remove local screenshots, Playwright output, and temporary traces before committing.

## 8. API/MCP verification — dispatch a subagent

For REST/MCP behavior changes (routes, tools, auth, permissions, status codes, pagination, date serialization):

1. Identify the coupled surfaces: route handler, MCP tool, feature/server function, contract JSON, and tests.
2. Decide REST/MCP parity explicitly.
3. Exercise the route or MCP tool through the public surface.
4. Inspect serialized output and compare with contracts and tests.
5. Redact tokens, cookies, OAuth codes, upload URLs, and personal data from output.

## 9. Open PR and finish the loop — dispatch $life-ustc-pr-workflow

After local checks pass, use `$life-ustc-pr-workflow` to:

1. Commit only intentional durable changes.
2. Push the branch.
3. Open or update the PR.
4. Monitor CI and Cloudflare checks.
5. Resolve review comments.
6. Merge when checks pass.

Do not rewrite history or force-push.

## 10. Static loader

To run the Docker static loader image:

```bash
docker build --target loader -t life-ustc-static-loader:check .
docker run --rm -e DATABASE_URL="$DATABASE_URL" -e STATIC_SNAPSHOT_URL="<snapshot-url>" life-ustc-static-loader:check
```

## Stop local services

```bash
docker compose -f docker-compose.dev.yml down
```
