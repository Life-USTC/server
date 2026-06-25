# src/features/

Business domain logic.

## Structure

```
home/          Dashboard panels, overview
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
  server/      Server data functions
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
- Visibility: public, logged-in, anonymous
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
- Owns feature-specific iCal event construction for sections, homework, and todos
- Keep generic time helpers in `src/lib/time`; keep calendar event semantics here

### subscriptions/
- Owns section subscription reads/writes used by pages, REST routes, dashboard data, and MCP tools
- Keep dashboard overview assembly in `home/` or `dashboard/`; consume subscription services from here
- Subscription import matching helpers belong here, while public section matching facts stay in `catalog/`

See root `AGENTS.md` for auth, dates, Prisma patterns.
