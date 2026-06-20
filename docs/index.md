# Documentation Index

`AGENTS.md` is the canonical instruction surface for coding agents. This index
is the project map: start here, then follow the closest source of truth.

## Start Here

- [Root agent guide](../AGENTS.md) - setup, commands, architecture boundaries, testing, and definition of done.
- [Repo skills](../.agents/skills/) - reusable task workflows for PRs, UI verification, and REST/MCP verification.
- [README](../README.md) - short project entry point and local quick start.
- [Contracts](contracts/) - modular JSON product/API/MCP contracts.

## Read by Task

| Task | Read first |
|------|------------|
| Understand the system | [Root agent guide](../AGENTS.md), then the closest scoped `AGENTS.md` |
| Run a PR/check workflow | `$life-ustc-pr-workflow` in [repo skills](../.agents/skills/) |
| Change a feature | `docs/contracts/<module>.json`, then `src/features/` and related routes/tools |
| Refine UI or layout | `$life-ustc-ui-verification`, affected component/page, and related Playwright spec |
| Change REST behavior | `$life-ustc-api-mcp-verification`, route handler, route OpenAPI JSDoc, `docs/contracts/openapi.json` |
| Change MCP behavior | `$life-ustc-api-mcp-verification`, `src/lib/mcp/AGENTS.md`, tool handler, `docs/contracts/mcp.json` |
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
| Architecture boundary or recurring agent mistake | The nearest scoped `AGENTS.md` for always-on rules, or `.agents/skills` for reusable workflows. |

## Major Docs

- [.agents/skills](../.agents/skills/) - checked-in reusable agent workflows.
- [docs/AGENTS.md](AGENTS.md) - documentation editing rules.
- [docs/contracts/AGENTS.md](contracts/AGENTS.md) - contract JSON workflow and validation.
- [docs/contracts.schema.json](contracts.schema.json) - schema for contract files.
- [docs/contracts/_product.json](contracts/_product.json) - product roles, workflow, and display conventions.
- [docs/contracts/openapi.json](contracts/openapi.json) - OpenAPI contract surface.
- [docs/contracts/mcp.json](contracts/mcp.json) - MCP contract surface.
- [docs/contracts/security.json](contracts/security.json) - security and permission expectations.
- [docs/observability.md](observability.md) - production logs, metrics, readiness, alerts, and dashboard guidance.

## Verification

- Default gate: `bun run verify`.
- Escalate to `bun run verify:full` for auth, data, browser, or shared tooling.
- Regenerate Prisma/OpenAPI artifacts with `bun run build`.
