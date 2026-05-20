# tools/

Build, seed, import scripts.

## Structure

```
shared/              Helper code
build/openapi/       OpenAPI generation
dev/check/           Convention checks
dev/seed/            Dev seed data
production/load/     Production imports
```

## Prisma in Scripts

```typescript
import {
  createToolPrisma,
  disconnectToolPrisma,
} from "@tools/shared/tool-prisma";

const prisma = createToolPrisma();

try {
  // work
} finally {
  await disconnectToolPrisma(prisma);
}
```

Use `tools/shared/tool-prisma.ts` for Prisma 7 adapter setup in scripts. Do not create ad hoc clients unless the script has a documented reason.

## Seed

Start local infra first when a script needs DB/storage:

```bash
docker compose -f docker-compose.dev.yml up -d
bun run dev:seed-scenarios  # Create
bun run dev:reset-scenarios # Clean
```

Seed data:
- Debug users (admin, normal, suspended)
- Current-semester scenarios
- Shared seed anchor/setup guidance lives in the repo root `AGENTS.md` (`DEV_SEED_ANCHOR`)

## Import

```bash
bun tools/production/load/load-from-static.ts
```

- Import from SQLite snapshot
- Preserve JW facts
- Bus import via `src/features/bus/lib/bus-import.ts`

## OpenAPI

```bash
bun run build:artifacts  # Generate + postprocess
```

## Verification

Default path for tool changes:

```bash
bun run verify:fast  # Most edits
bun run verify:full  # Shared tooling, seed flows, or integration-sensitive edits
```

## Convention Checks

```bash
bun run check:all      # Lint + docs + i18n + route/static import checks
bun run check:e2e      # E2E conventions
bun run check:features # Feature docs
```
