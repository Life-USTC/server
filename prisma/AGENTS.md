# prisma/

- Source of truth: `schema.prisma` + `migrations/`
- Seed SQL: `seed.sql` (see root `AGENTS.md` for fixture relationship). It is
  only for disposable local development and CI databases; never run it against
  production. Invoke it only with `ALLOW_DATABASE_SEED=true` after verifying
  that `DATABASE_URL` points to the intended disposable database.
- Generated (do not edit): `src/generated/prisma/`, `src/generated/prisma-node/`
- Static loader entry (repo root): `docker-entrypoint.load.sh`
- App imports: `import { prisma, getPrisma } from "@/lib/db/prisma"`

## Boundaries

- JW/Import: Semester, Course, Section, Teacher, Schedule, Exam
- User state: subscriptions, completions, todos, pins
- Collaborative: Homework, descriptions, comments, uploads
- Auth/OAuth: Better Auth models
- Bus: campuses, routes, stops, versions, trips

Normal users don't edit JW facts. Subscriptions are per current user. Homework
completion must not mutate the homework row. Todos are owner-scoped. Honor
`deletedAt` on reads.

## Schema changes

```bash
docker compose -f docker-compose.dev.yml up -d postgres
bunx prisma migrate dev
bun run app:prepare
# update seed fixtures + tests as needed
```

Naming: `id`, `jwId`, `code`, `nameCn`/`nameEn`, `createdAt`/`updatedAt`, `deletedAt`.
