# Documentation Index

`AGENTS.md` is the canonical instruction surface for coding agents. This index
is the project map: start here, then follow the closest source of truth.

## Start Here

- [Root agent guide](../AGENTS.md) - setup, commands, architecture boundaries, testing, and definition of done.
- [README](../README.md) - short project entry point and local quick start.
- [Contracts](contracts/) - modular JSON product/API/MCP contracts.

## Read by Task

| Task | Read first |
|------|------------|
| Understand the system | [Root agent guide](../AGENTS.md), then the closest scoped `AGENTS.md` |
| Change a feature | `docs/contracts/<module>.json`, then `src/features/` and related routes/tools |
| Change REST behavior | Route handler, route OpenAPI JSDoc, `docs/contracts/openapi.json` |
| Change MCP behavior | `src/lib/mcp/AGENTS.md`, tool handler, `docs/contracts/mcp.json` |
| Change data shape | `prisma/schema.prisma` and migrations |
| Change setup or operations | [README](../README.md), [Observability](observability.md), closest scoped `AGENTS.md` |

## Keep In Sync

| Change area | Update docs |
|-------------|-------------|
| Public REST API, route params, response shape, or status | Route OpenAPI JSDoc in `src/routes/api/**/+server.ts`; `docs/contracts/openapi.json` when contract coverage changes; regenerate with `bun run build`. |
| MCP tool, input parameter, auth behavior, output shape, or compaction | Matching `docs/contracts/<module>.json`; integration tests under `tests/integration/`. |
| User-visible web behavior, permissions, workflows, or labels | Matching `docs/contracts/<module>.json`; both message files when text changes. |
| Prisma model, enum, relation, migration, or seed contract | `prisma/schema.prisma`, migrations, and shared seed files when tests depend on it. |
| Setup, environment, Docker, CI, release, or operations | `README.md`, `.env.example`, `.github/workflows/AGENTS.md`, or the closest operational doc. |
| Architecture boundary or recurring agent mistake | The nearest scoped `AGENTS.md`, keeping guidance concise and specific. |

## Major Docs

- [docs/AGENTS.md](AGENTS.md) - documentation editing rules.
- [docs/contracts/AGENTS.md](contracts/AGENTS.md) - contract JSON workflow and validation.
- [docs/contracts.schema.json](contracts.schema.json) - schema for contract files.
- [docs/contracts/_product.json](contracts/_product.json) - product roles, workflow, and display conventions.
- [docs/contracts/openapi.json](contracts/openapi.json) - OpenAPI contract surface.
- [docs/contracts/mcp.json](contracts/mcp.json) - MCP contract surface.
- [docs/contracts/security.json](contracts/security.json) - security and permission expectations.
- [docs/observability.md](observability.md) - production logs, metrics, readiness, alerts, and dashboard guidance.

## Verification

- Default gate: `bun --silent run verify`.
- Escalate to `bun --silent run verify:full` for auth, data, browser, or shared tooling.
- Regenerate Prisma/OpenAPI artifacts with `bun run build`.
