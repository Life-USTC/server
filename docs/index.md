# Documentation Index

Root [`AGENTS.md`](../AGENTS.md) is the architecture map. Feature implementation
rules live in [`$life-ustc-feature`](../.agents/skills/life-ustc-feature/SKILL.md).
Commit / PR / CI / merge use global agent skills.

## Start Here

- [Architecture map](../AGENTS.md)
- [Feature skill](../.agents/skills/life-ustc-feature/SKILL.md)
- [README](../README.md) — product overview
- [Operations](operations.md) — production auth DB, Workers Builds, cleanup
- [Contracts](contracts/)
- [Interface hierarchy](interface-hierarchy.md)

## Read by Task

| Task | Read first |
|------|------------|
| Orient in the codebase | [AGENTS.md](../AGENTS.md), then nearest scoped `AGENTS.md` |
| Add or change a capability | `$life-ustc-feature` + `docs/contracts/<module>.json` |
| UI / layout | Affected feature components + Playwright under `tests/e2e/` |
| REST | Route handler, OpenAPI JSDoc, `docs/contracts/openapi.json` |
| GraphQL | Module contract, `graphql.json`, SDL snapshot, resolvers |
| MCP | `src/lib/mcp/AGENTS.md`, tool handler, module contract |
| Data shape | `prisma/schema.prisma` + migrations |
| Ops / observability | [operations.md](operations.md), [observability.md](observability.md) |

## Keep In Sync

| Change area | Update |
|-------------|--------|
| Public REST shape/status | Route OpenAPI JSDoc; `docs/contracts/openapi.json` when coverage changes; `bun run openapi:check` |
| GraphQL field/budget/schema | Module contract; `graphql.json`; SDL snapshot + tests |
| MCP tool/auth/output | Module contract; `tests/integration/` |
| User-visible web behavior | Module contract; both message files when text changes |
| Prisma / seed | schema, migrations, shared seed files |
| Setup / CI / ops | `operations.md`, `.env.example`, `.github/workflows/AGENTS.md` |
| Architecture map or layer rules | Root or nearest `AGENTS.md` |
| How features must be split | `.agents/skills/life-ustc-feature` |

## Major Docs

- [contracts/AGENTS.md](contracts/AGENTS.md)
- [contracts.schema.json](contracts.schema.json)
- [observability.md](observability.md)
- [rendering-and-cache.md](rendering-and-cache.md)
- [interface-hierarchy.md](interface-hierarchy.md)
- [conventions/homework-naming.md](conventions/homework-naming.md)
- [graphql/mutation-capabilities.json](graphql/mutation-capabilities.json)
- Generated OpenAPI: [`public/openapi.generated.json`](../public/openapi.generated.json)

## Useful commands (reference)

Core aliases: `bun run app:prepare`, `bun run build`, `bun run dev`,
`bun run e2e:server`, `bun run rest:test`, `bun run e2e:test`,
`bun run openapi:check`. CI phase scripts:
`.github/workflows/db-backed-bun-job.yml`.
