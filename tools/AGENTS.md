# tools/

Build, check, seed, import, E2E, and snapshot scripts.

## Structure

```
shared/              Helper code
build/openapi/       OpenAPI generation
dev/check.ts         Convention checks
dev/e2e.ts           E2E Cloudflare Worker runtime helper
dev/health.ts        Local app health probe
dev/artifacts/snapshots/
                     Visual snapshot capture and report workflow
dev/seed/            Dev seed data
load/                Static data imports
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

Start local infra first when a script needs DB/storage. Use the shared seed
entrypoint to create or reset scenarios; do not hand-edit seeded records.
Use `bun run seed -- --reset` when a full scenario reset is needed.

Seed data:
- Debug users (admin, normal, suspended)
- Current-semester scenarios
- Shared seed anchor/setup guidance lives in the repo root `AGENTS.md` (`DEV_SEED_ANCHOR`)

## Import

- Import from SQLite snapshot
- Preserve JW facts
- Bus import via `src/features/bus/lib/bus-import.ts`
- Loader Docker runtime only accepts `DATABASE_URL`; pass import choices as CLI flags such as `--skip-bus`.

## Tool Stages

```bash
bun run build                # regenerate Prisma/OpenAPI artifacts and build
bun --silent run verify      # most tool edits
bun --silent run verify:full # shared tooling, seed flows, integration-sensitive edits
```

Default entrypoints live in `package.json`; do not reintroduce TypeScript
wrappers whose only job is to spawn standard CLI commands.
Convention checks are internal tool phases and should stay focused on project
rules rather than general command orchestration.
Snapshot/E2E artifact changes are phase-sensitive: keep Worker build output,
Node Prisma fixtures, capture, cleanup, and publish steps aligned with the
existing workflow instead of moving work across phases casually. Keep long CI
snapshot shell in `tools/dev/artifacts/snapshots/snapshot-ci.ts` rather than
inline workflow YAML.
