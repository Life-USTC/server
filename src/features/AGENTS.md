# src/features/

Domain use-cases. Put one function (or a small set) per behavior under
`src/features/<domain>/server/`. REST / GraphQL / MCP / pages only parse
auth/args, call that use-case, and map the result.

Don't put business rules in `src/lib/api`, `src/lib/graphql`, or `src/lib/mcp`.
MCP compact / `mode` shaping is presentation only.

Example — workspace overview: REST `me-overview-route.ts`, GraphQL
`workspace.overview` (resolver file still named `viewer.ts`), and MCP tool
`workspace_overview_get` (handler under `my-data-overview-*.ts`) all call
`getCompactOverview`. Shared asserts: `tests/shared/scenarios/`.

## Layout

```text
feature/
  server/      Use-cases shared by all transports
  lib/         Domain utilities
  components/  Feature-owned UI (when needed)
```

Folders under this directory are the inventory. `dashboard/` is the signed-in
workspace UI (routes `/workspace/[tab]`); keep overview assembly there and use
`subscriptions/` for section membership.

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
