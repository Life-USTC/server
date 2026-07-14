# prisma/

Database schema and migrations.

## Files

```
schema.prisma    Source of truth
migrations/      Migration history
seed.sql         Canonical dev seed data
```

## Generated Output

```
src/generated/prisma/       → Cloudflare app client, DO NOT EDIT
src/generated/prisma-node/  → Node/Bun tool client, DO NOT EDIT
```

## Imports

```typescript
// App code and scripts use the generated app client
import { prisma, getPrisma } from "@/lib/db/prisma";
import type { User } from "@/generated/prisma/client";
```

Canonical seed data lives in `tests/e2e/fixtures/scenario.json`, `prisma/seed.sql`, and `tests/fixtures/dev-seed.ts`.

The static data loader entrypoint is `docker-entrypoint.load.sh`.

## Model Boundaries

- **JW/Import**: Semester, Course, Section, Teacher, Schedule, Exam
- **User State**: Subscriptions, completions, todos, pins
- **Collaborative**: Homework, descriptions, comments, uploads
- **Auth/OAuth**: Better Auth models
- **Bus**: Campuses, routes, stops, versions, trips

## Mutation Rules

- Normal users don't edit JW facts
- Subscription → current user only
- Homework completion → don't mutate homework
- Todo → scoped to owner
- Soft-delete (`deletedAt`) → check read paths

## Schema Changes

Start Postgres first for local migration work:

```bash
docker compose -f docker-compose.dev.yml up -d postgres
bunx prisma migrate dev # Create migration
bun run build # Generate artifacts and verify the production build
# Update seed scenarios
# Update E2E tests
```

## Naming

- `id` - Primary key
- `jwId` - JW external key
- `code` - Imported code
- `nameCn`/`nameEn` - Bilingual
- `createdAt`/`updatedAt` - Timestamps
- `deletedAt` - Soft delete

See root `AGENTS.md` for Prisma patterns.
