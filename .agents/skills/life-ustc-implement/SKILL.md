---
name: life-ustc-implement
description: "Add or change Life@USTC server behavior end-to-end: contracts, src/features/*/server, REST/GraphQL/MCP/Web adapters, i18n, Prisma, and the matching tests. Use when adding a route, GraphQL field, MCP tool, or user-facing flow. Do not use for git, PR, CI, or merge."
---

# Implement a Life@USTC server change

How to land a behavior change in this repo. Layout and local checks: root
`AGENTS.md`.

## When to use

- New user-facing flow or API
- Behavior change that touches permissions, shapes, or workflows
- Adding or changing a REST route, GraphQL field, or MCP tool

## Split the work across these layers

Every change usually touches several of these. Skip a layer only if you say why
(for example an auth redirect with no MCP twin).

| # | Piece | Location |
|---|--------|----------|
| 1 | Contract | `docs/contracts/<module>.json` (+ `openapi.json` / `graphql.json` / `mcp.json` as needed) |
| 2 | Use-case | `src/features/<domain>/server/` — one function (or a small set) per behavior |
| 3 | Web (if UI) | Thin `src/routes/...` + `src/features/<domain>/components/` (workspace UI → `dashboard/`, routes `/workspace/*`) |
| 4 | REST (if HTTP API) | `src/routes/api/.../+server.ts` → `src/lib/api/routes/` → feature server |
| 5 | GraphQL (if exposed) | `src/lib/graphql/` resolver calling the same feature server |
| 6 | MCP (if exposed) | `src/lib/mcp/tools/<domain>/` — thin adapter; tool name matches the contract id |
| 7 | Copy | Both `messages/zh-cn.json` and `messages/en-us.json` when user-facing text changes |
| 8 | Data | `prisma/schema.prisma` + migration when persistence changes; keep seed fixtures in sync |

Names and scope: `docs/interface-hierarchy.md`. Don't put business rules in
`src/lib/api`, `src/lib/graphql`, or `src/lib/mcp` (MCP compact / `mode` is
presentation only).

## Adapter pattern

```text
transport: parse auth / args / locale
    → features/<domain>/server use-case
    → map result (HTTP JSON | GraphQL fields | jsonToolResult + mode)
```

Same behavior on more than one transport: prefer helpers under
`tests/shared/scenarios/`.

## Tests

| Change | Minimum tests |
|--------|----------------|
| Pure helper / permission / date / schema shaping | `tests/unit/` covering the new logic |
| Domain write/read with DB or MCP | `tests/integration/` (MCP harness and/or `rest:test`) |
| User-visible Web flow | Focused Playwright under `tests/e2e/` |
| Public REST shape | OpenAPI JSDoc on the route + `bun run openapi:check` |
| GraphQL schema | Update contracts + SDL snapshot test |

- Unit tests only under `tests/unit/` (never under `src/`).
- Prefer `DEV_SEED_ANCHOR` / `tests/fixtures/dev-seed.ts`; don't change shared
  seed rows from parallel tests — use isolated users and cleanup.
- Harness details: `tests/integration/AGENTS.md`. E2E habits: `tests/e2e/AGENTS.md`.

## Keep REST / GraphQL / MCP in sync

When one of REST / GraphQL / MCP changes:

1. List which of those should change.
2. If only one changes, say why (transport-only exception or intentional exclusion —
   see `docs/graphql/mutation-capabilities.json` for write parity).
3. Keep ownership, permissions, ids, Shanghai date rules, and error types aligned
   everywhere you expose the same behavior.

## Before you stop

- [ ] Contract module updated (or justified skip)
- [ ] Use-case in `features/*/server` (not buried in route / MCP / GraphQL bodies)
- [ ] Every intended transport wired as a thin adapter
- [ ] Both locales if user-facing strings changed
- [ ] Unit tests for new pure / domain logic
- [ ] Integration and/or E2E for the path users or clients actually hit
- [ ] No native IO in ordinary features / routes (see root `AGENTS.md`)
- [ ] No scratch plans or reports left in the tree

Run the local checks in root `AGENTS.md` that cover what you touched. Shipping
through git / CI / PR is outside this skill.
