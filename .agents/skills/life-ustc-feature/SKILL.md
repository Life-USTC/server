---
name: life-ustc-feature
description: "Implement or change a Life@USTC server capability: split work across contracts, features/server, transports (REST/GraphQL/MCP/Web), i18n, Prisma, and the required unit/integration/E2E tests. Use when adding features, APIs, MCP tools, or cross-surface behavior. Not for commit/PR/CI/merge workflow."
---

# Life@USTC Feature Implementation

Project skill for **how a capability is built in this repo**. Architecture map:
root `AGENTS.md`. Commit, PR, CI watch, review, and merge use **global** agent
skills — not this file.

## When to use

- New user-visible or API capability
- Behavior change that touches permissions, shapes, or workflows
- Adding/changing a REST route, GraphQL field, or MCP tool

## Module split (required)

Every new or changed capability is split across these layers. Skip a layer only
with an explicit reason (e.g. transport-only auth redirect has no MCP twin).

| # | Module | Location |
|---|--------|----------|
| 1 | Contract | `docs/contracts/<module>.json` (+ `openapi.json` / `graphql.json` / `mcp.json` as needed) |
| 2 | Domain use-case | `src/features/<domain>/server/` — one function (or small set) per capability |
| 3 | Web (if UI) | `src/routes/...` thin + `src/features/<domain>/components/` (workspace UI → `dashboard/`, routes `/workspace/*`) |
| 4 | REST (if HTTP API) | `src/routes/api/.../+server.ts` → `src/lib/api/routes/` adapter → call feature server |
| 5 | GraphQL (if exposed) | `src/lib/graphql/` resolver calling the same feature server |
| 6 | MCP (if exposed) | `src/lib/mcp/tools/<domain>/` — thin adapter; tool **name** = capability id |
| 7 | Copy | `messages/zh-cn.json` and `messages/en-us.json` when user-facing text changes |
| 8 | Data | `prisma/schema.prisma` + migration when persistence changes; update seed trio if fixtures need it |

Naming and scope: `docs/interface-hierarchy.md`. Do not put business rules in
`src/lib/api`, `src/lib/graphql`, or `src/lib/mcp` (MCP compact/`mode` is view-only).

## Adapter pattern

```text
transport: parse auth / args / locale
    → features/<domain>/server use-case
    → map result (HTTP JSON | GraphQL fields | jsonToolResult + mode)
```

Shared cross-surface asserts: prefer `tests/shared/scenarios/` when the same
behavior is exposed on multiple transports.

## Tests (required)

| Change | Minimum tests |
|--------|----------------|
| Pure helper / permission / date / schema shaping | `tests/unit/` covering the new logic |
| Domain write/read with DB or MCP | `tests/integration/` (MCP harness and/or `rest:test` path) |
| User-visible Web flow | Focused Playwright under `tests/e2e/` for the journey |
| Public REST shape | OpenAPI JSDoc on the route + `bun run openapi:check` |
| GraphQL schema | Update contracts + SDL snapshot test (`tests/unit/graphql-schema-snapshot.test.ts`) |

- Put unit tests only under `tests/unit/` (never colocated under `src/`).
- Prefer `DEV_SEED_ANCHOR` / `tests/fixtures/dev-seed.ts`; do not mutate canonical
  seed rows in parallel — use isolated users and cleanup.
- Integration harness rules: `tests/integration/AGENTS.md`.
- E2E selector/flake rules: `tests/e2e/AGENTS.md`.

## Surface parity

When one of REST / GraphQL / MCP changes:

1. List which surfaces should change.
2. If only one changes, document why (transport exception or intentional exclusion —
   see `docs/graphql/mutation-capabilities.json` for write parity).
3. Keep ownership, permission, identifiers, Shanghai date boundaries, and error
   class aligned across surfaces that expose the capability.

## Checklist before leaving the implementation

- [ ] Contract module updated (or justified skip)
- [ ] Use-case in `features/*/server` (not in route/MCP/GraphQL bodies)
- [ ] Every intended transport wired as a thin adapter
- [ ] Both locales if user-facing strings changed
- [ ] Unit tests for new pure/domain logic
- [ ] Integration and/or E2E coverage matching the risk surface
- [ ] No native IO in ordinary features/routes (see root `AGENTS.md`)
- [ ] No scratch plans/reports left in the tree

Run whatever local checks prove the above; shipping through git/CI/PR is outside
this skill.
