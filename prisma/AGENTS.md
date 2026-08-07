# prisma/

- Source of truth: `schema.prisma` + `migrations/`
- Seed SQL: `seed.sql` (canonical scenario; see root `AGENTS.md` Shared Test Seed)
- Generated (DO NOT EDIT): `src/generated/prisma/`, `src/generated/prisma-node/`
- Static loader entry: `docker-entrypoint.load.sh`
- App imports: `import { prisma, getPrisma } from "@/lib/db/prisma"`

## Boundaries

- JW/Import: Semester, Course, Section, Teacher, Schedule, Exam
- User state: subscriptions, completions, todos, pins
- Collaborative: Homework, descriptions, comments, uploads
- Auth/OAuth: Better Auth models
- Bus: campuses, routes, stops, versions, trips

Normal users do not edit JW facts. Subscriptions are per current user. Homework
completion must not mutate the homework row. Todos are owner-scoped. Honor
`deletedAt` on reads.

## Schema changes

```bash
docker compose -f docker-compose.dev.yml up -d postgres
bunx prisma migrate dev
bun run app:prepare
# update seed scenarios + tests as needed
```

Naming: `id`, `jwId`, `code`, `nameCn`/`nameEn`, `createdAt`/`updatedAt`, `deletedAt`.
