---
name: "life-ustc-pr-workflow"
description: "Pull request lifecycle for Life@USTC: branch publishing, PR body updates, CI/Cloudflare checks, review feedback, merges, and active PR handoff."
---

# Life@USTC PR Workflow

Use this skill for PR lifecycle work only: branch publishing, PR body updates, CI/Cloudflare failures, review feedback, merges, and active-PR handoff. For implementation and local verification, use `$life-ustc-dev-loop` first.

## Core loop

1. Read root `AGENTS.md` and the nearest scoped `AGENTS.md`.
2. Inspect the source of truth: route handlers, feature/server code, Prisma schema/migrations, contract JSON, tests, and workflows.
3. State the smallest verifiable plan.
4. Edit only the files needed.
5. Run local checks via `$life-ustc-dev-loop` (dispatch a subagent for the full check sequence).
6. Inspect `git diff` and remove generated scratch artifacts.
7. Commit with a conventional message, push, and open or update the PR.
8. Wait for checks; if one fails, inspect logs, reproduce locally, fix, push, and wait again.
9. Before handoff, confirm PR status, local `git status -sb`, commands run, skipped checks, and residual risk.

## Guardrails

- Do not rewrite history or force-push. For stacked PRs, merge the updated base branch into the head branch.
- Do not leave local snapshot reports, Playwright output, temporary logs, or ad hoc probes behind.
- Keep durable repo skills in `.agents/skills`; do not add `.codex/skills`.

## Local verification

Before creating or updating a PR, run the relevant checks from `$life-ustc-dev-loop`:

- Default change: dispatch a subagent to run the full check sequence (biome, svelte-check, tsc, vitest).
- Data/auth/browser/shared-tooling changes: also run integration and E2E tests.
- Production build or Cloudflare concern: `bun run app:prepare && bun run build` and, when useful, `bunx wrangler deploy --dry-run --outdir /tmp/life-ustc-wrangler-dry-run`.

Stop Docker services you started:

```bash
docker compose -f docker-compose.dev.yml down
```

## PR body

Follow `.github/PULL_REQUEST_TEMPLATE.md` and include:

- What changed.
- Docs/contracts impact.
- Verification commands grouped by intent.
- Complete-loop evidence when applicable.
- Skipped checks with reasons.
- Residual risks.
- Stacked PR base, if applicable.

Use one concise line for remote check status. Do not paste every job entry into the PR body. Use draft PRs when work is still under active agent iteration.

## CI and check failures

Check current PR state:

```bash
gh pr checks <pr> --json name,state,bucket,workflow,link
```

For GitHub Actions failures:

- Fetch metadata: `gh api repos/Life-USTC/server/actions/jobs/<job_id>`.
- Fetch annotations: `gh api repos/Life-USTC/server/check-runs/<check_run_id>/annotations`.
- Fetch focused logs: `gh run view <run_id> --job <job_id> --log`.

For Cloudflare Workers Builds:

- Verify repo-side build with `bun run app:prepare && bun run build`.
- Verify package/deploy shape with `bunx wrangler deploy --dry-run --outdir /tmp/life-ustc-wrangler-dry-run`.
- If local build passes but Cloudflare fails without logs, retry via the provider or push a legitimate follow-up change.

## Review follow-up

- Lead with findings if doing a review.
- Use thread-aware GitHub review workflows for unresolved inline threads.
- Implement only actionable fixes.
- Re-run relevant local checks from `$life-ustc-dev-loop`.
- Push and wait for PR checks.
- Resolve GitHub review threads only after the fix is implemented, pushed, and verified. Do not resolve ambiguous, unfixed, or intentionally deferred threads.
- Summarize addressed comments, commands run, and anything intentionally deferred.
