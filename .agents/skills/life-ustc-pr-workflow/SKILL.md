---
name: "life-ustc-pr-workflow"
description: "Use for Life-USTC pull request work: branch publishing, PR body updates, GitHub Actions or Cloudflare checks, CI failures, review feedback, review-thread resolution, merges, or active PR handoff."
---

# Life-USTC PR Workflow

## Core Loop

Use this sequence when the user asks for PR, check, review, publish, merge, or
active-PR lifecycle work. For ordinary implementation without PR lifecycle work,
follow root `AGENTS.md` and the nearest scoped guide instead.

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

## Workflow Guardrails

- Use root `AGENTS.md` and scoped guides for architecture, contract, and feature
  rules; this skill only adds PR lifecycle procedure.
- For code changes, check matching contracts, OpenAPI, tests, and docs according
  to the source/scoped guides before pushing.
- Keep durable repo skills in `.agents/skills`; do not add `.codex/skills` unless the user explicitly asks for a Codex-private experiment.
- Do not rewrite history or force-push. For stacked PRs, prefer merging the updated base branch into the head branch.
- Do not leave local snapshot reports, Playwright output, temporary logs, or ad hoc probes behind.

## Local Checks

Use the highest relevant gate:

- Default: `bun run verify`
- Data/auth/browser/shared-tooling changes: `bun run verify:full`
- Production build or Cloudflare concern: `bun run build` and, when useful, `bunx wrangler deploy --dry-run --outdir /tmp/life-ustc-wrangler-dry-run`
- E2E scope reproduction:
  - Run `bunx playwright install chromium` once on a new local machine. Use `bunx playwright install --with-deps chromium` on Linux if browser system libraries are missing.
  - `docker compose -f docker-compose.dev.yml up -d`
  - `bun run db:migrate:deploy`
  - `bun run seed`
  - `bun run build`
  - `bun run e2e:prepare`
  - `bunx playwright test --reporter=list -- <paths>`
- Snapshot workflow changes:
  - `bun run tools/dev/artifacts/snapshots/snapshot-ci.ts capture`

Stop local Docker services you started with:

```bash
docker compose -f docker-compose.dev.yml down
```

Prefer skills and documented procedures for agent workflow steps. Do not add
new TypeScript command-orchestration scripts for one-off local setup or PR
process guidance.

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

PR body should follow `.github/PULL_REQUEST_TEMPLATE.md` and include:

- What changed.
- Docs/contracts impact.
- Verification commands grouped by intent, not a raw command or CI transcript.
- Complete-loop evidence, when applicable.
- Skipped checks with reasons.
- Residual risks.
- Stacked PR base, if applicable.

Use one concise line for remote check status, such as the current commit and
whether CI, E2E, CodeQL, Cloudflare, or other required checks are green. Do not
paste every job entry into the PR body.

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
- Use GitHub metadata/comments plus local source inspection. For unresolved
  inline threads, use the thread-aware GitHub review workflow rather than flat
  comment lists.
- Implement only actionable review fixes.
- Re-run relevant local checks.
- Push and wait for PR checks after changes.
- If the user explicitly asks to resolve review comments or threads, resolve the
  GitHub review thread after the fix is implemented, pushed, and verified.
  Do not resolve ambiguous, unfixed, or intentionally deferred threads.
- Summarize addressed comments, commands run, and anything intentionally deferred.
