# prisma/

Database schema and migrations.

## Files

```
schema.prisma    Source of truth
migrations/      Migration history
```

## Generated Output

```
src/generated/prisma/  → DO NOT EDIT
```

## Imports

```typescript
// App code
import { prisma, getPrisma } from "@/lib/db/prisma";
import type { User } from "@/generated/prisma/client";

// Scripts
import {
  createToolPrisma,
  disconnectToolPrisma,
} from "@tools/shared/tool-prisma";

const prisma = createToolPrisma();
// ... use ...
await disconnectToolPrisma(prisma);
```

Canonical seed data lives in `tests/e2e/fixtures/scenario.json`, `tools/dev/seed/seed-dev-scenarios.ts`, and `tools/dev/seed/dev-seed.ts`.

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
bun run prisma:migrate  # Create migration
bun run build:artifacts # Generate client + OpenAPI
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
