---
name: "life-ustc-pr-workflow"
description: "End-to-end development workflow for the Life-USTC/server repository. Use when implementing fixes or features, updating contracts/docs/tests, publishing or updating PRs, monitoring GitHub Actions and Cloudflare checks, or addressing PR review feedback in this repo."
---

# Life-USTC PR Workflow

## Core Loop

Use this sequence for non-trivial repo work:

1. Read `AGENTS.md` and the nearest scoped `AGENTS.md` before editing.
2. Inspect the current source of truth: route handlers, feature/server code, Prisma schema/migrations, contract JSON, tests, workflows, and package scripts.
3. Use focused repo skills when they apply: `$life-ustc-ui-verification` for UI/browser changes and `$life-ustc-api-mcp-verification` for REST/MCP behavior changes.
4. State the smallest verifiable plan when the task has more than one step.
5. Edit only the files needed for the request.
6. Run the relevant local checks and any focused complete-loop checks.
7. Inspect `git diff` and remove generated scratch artifacts.
8. When the user asks for a PR or the task is already on an active PR branch, commit with a conventional message, push, open or update the PR, then wait for checks.
9. If a check fails, inspect logs, reproduce locally where possible, fix, push, and wait again.
10. Before handoff, confirm PR status when applicable, local `git status -sb`, commands run, skipped checks, and residual risk.

## Implementation Rules

- Keep `src/routes` thin. Put reusable domain work in `src/features/*/server`.
- Do not call SvelteKit page handlers or REST route handlers from features or page actions. Extract shared work into feature/server functions and keep HTTP response mapping in API route adapters.
- Update `docs/contracts/*`, OpenAPI annotations, user docs, or scoped `AGENTS.md` only when behavior, API/MCP contracts, setup, permissions, or architecture guidance changes.
- Treat REST, MCP, contract JSON, OpenAPI, tests, and seed data as coupled surfaces.
- Keep durable repo skills in `.agents/skills`; do not add `.codex/skills` unless the user explicitly asks for a Codex-private experiment.
- Do not rewrite history or force-push. For stacked PRs, prefer merging the updated base branch into the head branch.
- Do not leave local snapshot reports, Playwright output, temporary logs, or ad hoc probes behind.

## Local Checks

Use the highest relevant gate:

- Default: `bun --silent run verify`
- Data/auth/browser/shared-tooling changes: `bun --silent run verify:full`
- Production build or Cloudflare concern: `bun run build` and, when useful, `bunx wrangler deploy --dry-run --outdir /tmp/life-ustc-wrangler-dry-run`
- E2E scope reproduction:
  - `docker compose -f docker-compose.dev.yml up -d`
  - `bun run db migrate deploy`
  - `bun run seed`
  - `bun run build`
  - `bun --silent run tools/dev/e2e.ts prepare`
  - `bunx playwright test --reporter=list -- <paths>`
- Snapshot workflow changes:
  - `bun run tools/dev/artifacts/snapshots/snapshot-ci.ts capture`

Stop local Docker services you started with:

```bash
docker compose -f docker-compose.dev.yml down
```

## Complete-Loop Evidence

- UI/layout changes need browser evidence. Use `$life-ustc-ui-verification` when a screen, route, component, CSS, copy, or responsive layout is affected.
- REST/MCP behavior changes need serialized output evidence. Use `$life-ustc-api-mcp-verification` when request/response shape, tool output, status codes, permissions, pagination, or date serialization changes.
- If a complete-loop check is not feasible, state why and what evidence covers the risk instead.

## PR Flow

Before creating or updating a PR:

- Run `git status -sb`.
- Inspect `git diff` for unrelated edits, generated files, docs/test gaps, and REST/MCP parity gaps.
- Commit only intentional durable changes.
- Push the branch.

PR body should include:

- What changed.
- Docs/contracts impact.
- Verification commands.
- Complete-loop evidence, when applicable.
- Skipped checks with reasons.
- Residual risks.
- Stacked PR base, if applicable.

Use draft PRs when work is still under active agent iteration.

## CI And Check Failures

Check current PR state with:

```bash
gh pr checks <pr> --json name,state,bucket,workflow,link
```

For GitHub Actions failures:

- Fetch job metadata with `gh api repos/Life-USTC/server/actions/jobs/<job_id>`.
- Fetch annotations with `gh api repos/Life-USTC/server/check-runs/<check_run_id>/annotations`.
- Fetch focused logs with `gh run view <run_id> --job <job_id> --log`.
- If full log downloads hang, use metadata, annotations, uploaded artifacts, and local reproduction.

For external checks:

- Treat Cloudflare Workers Builds as external unless GitHub exposes useful logs.
- Verify repo-side build with `bun run build`.
- Verify package/deploy shape with `bunx wrangler deploy --dry-run --outdir /tmp/life-ustc-wrangler-dry-run`.
- If local build and dry-run pass but Cloudflare fails without logs, retry via the provider if available or push a legitimate follow-up change that belongs in the PR.

For stacked PRs:

- Check every open PR in the stack.
- If the lower PR fails due a fix already present above it, move the relevant fix down to the lower branch.
- Merge the updated lower branch into higher branches and push them so GitHub compares against the correct base.
- Wait until each PR's current HEAD checks are green.

## Review Follow-Up

When asked to review or address review feedback:

- Lead with findings if doing a review.
- Use GitHub metadata/comments plus local source inspection.
- Implement only actionable review fixes.
- Re-run relevant local checks.
- Push and wait for PR checks after changes.
- Summarize addressed comments, commands run, and anything intentionally deferred.
