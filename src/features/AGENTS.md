# src/features/

Business domain logic and **application use-cases**.

## Adapter rule

One use-case function per capability lives under `src/features/<domain>/server/`.
Transport surfaces are thin adapters only:

1. Parse auth / scope / locale / query or tool args
2. Call the feature use-case
3. Map the result to the transport shape (HTTP JSON, GraphQL fields, or MCP
   `jsonToolResult` + compact mode)

Do **not** put business rules in `src/lib/api`, `src/lib/graphql`, or
`src/lib/mcp`. MCP-only presentation (compact pickers, `mode` summary/full)
stays in `src/lib/mcp` as a **view layer**, not as a second write path.

### Worked example: workspace overview

| Surface | Adapter | Use-case |
|---------|---------|----------|
| REST `GET /api/workspace/overview` | `src/lib/api/routes/me-overview-route.ts` | `getCompactOverview` |
| GraphQL `workspace.overview` | `src/lib/graphql/viewer.ts` | `getCompactOverview` |
| MCP `workspace_overview_get` | `src/lib/mcp/tools/workspace/my-data-overview-action.ts` | `getCompactOverview` |

Shared cross-adapter assertions live in `tests/shared/scenarios/`
(`overview.ts`, `todo-crud.ts`, `homework-create.ts`).

Homework create/update/delete and todo CRUD already follow the same pattern
(`createHomeworkForSection` / `updateHomework` / `deleteHomework`,
`createTodo` / … in `features/*/server`).

## Structure

```
dashboard/     Personal workspace pages, panels, overview, and assistant snapshots
homeworks/     Section homework (not todos)
todos/         Personal tasks
comments/      Object-scoped discussions
uploads/       Comment attachments
descriptions/  Platform markdown content
dashboard-links/ Link catalog
bus/           Public timetable
calendar/      Calendar export and iCal generation
subscriptions/ Section subscription read/write services and import helpers
```

## Layout

```
feature/
  server/      Use-case / server data functions (shared by REST, GraphQL, MCP, pages)
  lib/         Domain utilities
```

## Key Rules

### homeworks/
- Attached to section, not user
- Signed-in, unsuspended can create/update
- Delete: creator or admin only
- Completion is per-user, separate from entity

### todos/
- Purely personal
- User owns CRUD
- Due date → calendar (if incomplete)

### comments/
- Scoped to section/course/teacher/homework
- Audience visibility: public or logged-in-only; anonymous posting uses `isAnonymous`
- Suspended can't create
- Admin can moderate

### uploads/
- Comment attachments
- Pending-upload flow
- Check permissions for downloads

### bus/
- Public timetable
- Signed-in preference save
- Import idempotent by version

### calendar/
- Owns feature-specific calendar event queries and iCal export construction for sections, homework, and todos
- Keep generic time helpers in `src/lib/time`; keep calendar event semantics here

### subscriptions/
- Owns section subscription reads/writes used by pages, REST routes, dashboard data, and MCP tools
- Keep dashboard overview assembly in `dashboard/`; consume subscription services from here
- Subscription import matching helpers belong here, while public section matching facts stay in `catalog/`

See root `AGENTS.md` for auth, dates, Prisma patterns.
