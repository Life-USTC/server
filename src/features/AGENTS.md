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
| admin | Users, suspensions, moderation, OAuth clients, bus import governance |
| api-docs | OpenAPI reference UI shell (no `server/` use-cases) |
| auth | Sign-in page load and related helpers |
| bus | Public timetable; signed-in preferences; import idempotent by version |
| calendar | Feature event queries + iCal; generic time helpers stay in `src/lib/time` |
| catalog | Courses, sections, teachers, schedules, exams, public list/detail pages |
| comments | Scoped to section/course/teacher/homework; audience + anonymous flags; suspended cannot create |
| dashboard | Signed-in workspace UI and overview assembly (routes `/workspace/*`) |
| dashboard-links | Campus link catalog + pin/visit preferences |
| descriptions | Shared wiki-like text on course/section/teacher/homework |
| homeworks | Attached to section; signed-in unsuspended create/update; delete creator/admin; completion is per-user |
| markdown | Shared Markdown rendering helpers for guides/community |
| mobile-app | Mobile app marketing/download page |
| oauth | Device, consent, authorize, and client-registration policies |
| profile | Public user profile pages and contribution summaries |
| publications | News/publication list and detail; crawler ingestion; Web at `/news` |
| search | Global search across catalog and links |
| section-detail | Section detail page load and homework tab UI |
| settings | Account settings, security, authorizations, deletion |
| subscriptions | Section membership R/W + import match helpers; public section facts stay in `catalog/` |
| todos | Personal CRUD; incomplete due dates feed calendar |
| uploads | Comment attachments; pending-upload flow; shared download gate |
| usage | Client usage guides (MCP, CLI, Bot, mobile) |
| weather | Campus weather snapshot and history; Amap / Open-Meteo adapters |
| welcome | First-login profile completion |
| young | 第二课堂 young-event catalog list/detail and image proxy |
