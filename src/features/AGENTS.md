# src/features/

Business domain logic.

## Structure

```
home/          Dashboard panels, overview
homework/      Section homework (not todos)
todos/         Personal tasks
comments/      Object-scoped discussions
uploads/       Comment attachments
descriptions/  Platform markdown content
dashboard-links/ Link catalog
bus/           Public timetable
```

## Layout

```
feature/
  server/      Server data functions
  lib/         Domain utilities
```

## Key Rules

### homework/
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

See root `AGENTS.md` for auth, dates, Prisma patterns.
