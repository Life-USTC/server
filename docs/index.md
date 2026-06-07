# Documentation Index

`AGENTS.md` is the canonical instruction surface for coding agents. This index is a navigation map for source-of-truth docs and the code surfaces they track.

## Start Here

- [Root agent guide](../AGENTS.md) - setup, commands, architecture boundaries, testing, and definition of done.
- [README](../README.md) - short project entry point and local quick start.
- [Feature specs](features/) - modular JSON product/API/MCP contracts.

## Code To Docs Map

| Change area | Update docs |
|-------------|-------------|
| Public REST API, route params, response shape, or status | Route OpenAPI JSDoc in `src/app/api/**/route.ts`; `docs/features/openapi.json` when feature coverage changes; regenerate with `bun run build:artifacts`. |
| MCP tool, input parameter, auth behavior, output shape, or compaction | Matching `docs/features/<module>.json`; integration tests under `tests/integration/`. |
| User-visible web behavior, permissions, workflows, or labels | Matching `docs/features/<module>.json`; both message files when text changes. |
| Prisma model, enum, relation, migration, or seed contract | `prisma/schema.prisma`, migrations, `docs/features/_models.json` or `_enums.json`, and shared seed files when tests depend on it. |
| Setup, environment, Docker, CI, release, or operations | `README.md`, `.env.example`, `.github/workflows/AGENTS.md`, or the closest operational doc. |
| Architecture boundary or recurring agent mistake | The nearest scoped `AGENTS.md`, keeping guidance concise and specific. |

## Major Docs

- [docs/AGENTS.md](AGENTS.md) - documentation editing rules.
- [docs/features/AGENTS.md](features/AGENTS.md) - feature JSON workflow and validation.
- [docs/features.schema.json](features.schema.json) - schema for feature contract files.
- [docs/features/_product.json](features/_product.json) - product roles, workflow, and display conventions.
- [docs/features/_models.json](features/_models.json) - Prisma model documentation.
- [docs/features/_enums.json](features/_enums.json) - enum documentation.
- [docs/features/openapi.json](features/openapi.json) - OpenAPI feature surface.
- [docs/features/mcp.json](features/mcp.json) - MCP feature surface.
- [docs/features/security.json](features/security.json) - security and permission expectations.
- [docs/observability.md](observability.md) - production logs, metrics, readiness, alerts, and dashboard guidance.

## Verification

- Default gate: `bun run verify:fast`.
- Feature contract check: `bun run check:features`.
- API/OpenAPI generation: `bun run build:artifacts`.
- Full flow for auth, data, browser, or shared tooling changes: `bun run verify:full`.
