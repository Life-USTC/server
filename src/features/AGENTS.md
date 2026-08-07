# src/features/

Domain use-cases. One capability function lives under
`src/features/<domain>/server/`. Transports (REST / GraphQL / MCP / pages) only
parse auth/args, call the use-case, and map the result.

Do **not** put business rules in `src/lib/api`, `src/lib/graphql`, or
`src/lib/mcp`. MCP compact/`mode` shaping is a view layer only.

Example — workspace overview: REST `me-overview-route.ts`, GraphQL
`workspace.overview` (resolver module still named `viewer.ts`), and MCP
`my-data-overview-action` all call `getCompactOverview`. Shared assertions:
`tests/shared/scenarios/`.

## Layout

```text
feature/
  server/      Use-cases shared by all surfaces
  lib/         Domain utilities
  components/  Feature-owned UI (when needed)
```

Feature folders under this directory are the inventory. `dashboard/` is the
signed-in workspace UI (routes `/workspace/[tab]`); keep overview assembly there
and consume `subscriptions/` for section membership.

## Domain rules

| Domain | Notes |
|--------|-------|
| homeworks | Attached to section; signed-in unsuspended create/update; delete creator/admin; completion is per-user |
| todos | Personal CRUD; incomplete due dates feed calendar |
| comments | Scoped to section/course/teacher/homework; audience + anonymous flags; suspended cannot create |
| uploads | Comment attachments; pending-upload flow; shared download gate |
| bus | Public timetable; signed-in preferences; import idempotent by version |
| calendar | Feature event queries + iCal; generic time helpers stay in `src/lib/time` |
| subscriptions | Section membership R/W + import match helpers; public section facts stay in `catalog/` |

Architecture map: root `AGENTS.md`. New capabilities: `$life-ustc-feature`.
