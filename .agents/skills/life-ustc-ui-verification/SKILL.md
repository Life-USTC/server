---
name: life-ustc-ui-verification
description: "Verify Life-USTC user-visible UI changes with browser evidence after Svelte page, component, CSS, responsive layout, copy, navigation, snapshot, or visual-regression changes."
---

# Life USTC UI Verification

## Overview

Use this skill to close the loop on user-visible UI work with browser evidence, not just static checks. Keep screenshots and traces out of the repo unless they are intentional test fixtures.

## Workflow

1. Read root `AGENTS.md`, `tests/e2e/AGENTS.md`, and the nearest scoped guide for the changed files.
2. Identify the smallest screen or journey that exercises the visual change.
3. Prefer an existing Playwright spec for that route. If none exists and the change is visual-only, use an ad hoc Playwright/browser run against the local app.
4. Capture and inspect browser evidence before handoff. Use a screenshot, headed Playwright run, or Playwright UI trace that shows the affected area.
5. Iterate on visible regressions, then rerun the focused check.
6. Remove local screenshots, Playwright output, temporary traces, and ad hoc scripts before committing unless they are deliberate fixtures.

## Local Commands

For seeded Worker-backed E2E reproduction:

```bash
bunx playwright install chromium
docker compose -f docker-compose.dev.yml up -d
bun run build
bun run e2e:prepare
bun run db:migrate:deploy
bun run seed
bunx playwright test --reporter=list -- <path>
```

On Linux, use `bunx playwright install --with-deps chromium` if browser system
libraries are missing.

For interactive visual refinement:

```bash
bunx playwright test --headed <path>
bunx playwright test --ui
```

Use `bun run verify:full` before pushing when the change affects browser flows broadly.

Stop Docker services you started:

```bash
docker compose -f docker-compose.dev.yml down
```

## Screenshot Review Checklist

- Check the affected screen at a representative desktop viewport.
- Check a mobile viewport when responsive layout, wrapping, navigation, forms, or cards are touched.
- Inspect for blank assets, hydration errors, overlapping content, clipped text, unexpected scrollbars, unstable hover/focus sizing, and unreadable contrast.
- Verify loading, empty, error, and permission states when the change touches those states.
- Prefer role/label/text selectors in any new Playwright coverage.

## Handoff Evidence

Summarize the exact screen or journey inspected, viewport coverage, commands run, and any skipped visual checks with the reason.
