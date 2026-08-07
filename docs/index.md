# Documentation Index

Root [`AGENTS.md`](../AGENTS.md) is the architecture map (plus Commands). Feature
implementation: [`$life-ustc-feature`](../.agents/skills/life-ustc-feature/SKILL.md).
Commit / PR / CI / merge: global agent skills.

## Start here

- [Architecture map + Commands](../AGENTS.md)
- [Feature skill](../.agents/skills/life-ustc-feature/SKILL.md)
- [README](../README.md) — product overview
- [Operations](operations.md)
- [Contracts](contracts/)
- [Interface hierarchy](interface-hierarchy.md)

## Read by task

| Task | Read first |
|------|------------|
| Orient in the codebase | [AGENTS.md](../AGENTS.md), then nearest scoped `AGENTS.md` |
| Add or change a capability | `$life-ustc-feature` + `docs/contracts/<module>.json` |
| UI / layout | Feature components + Playwright under `tests/e2e/` |
| REST | Route handler, OpenAPI JSDoc, `docs/contracts/openapi.json` |
| GraphQL | Module contract, `graphql.json`, SDL snapshot, resolvers |
| MCP | `src/lib/mcp/AGENTS.md`, tool handler, module contract |
| Data shape | `prisma/schema.prisma` + migrations |
| Ops / observability | [operations.md](operations.md), [observability.md](observability.md) |

## Keep in sync

| Change area | Update |
|-------------|--------|
| Public REST | Route OpenAPI JSDoc; `openapi.json` when coverage changes; `bun run openapi:check` |
| GraphQL | Module contract; `graphql.json`; SDL snapshot + tests |
| MCP | Module contract; `tests/integration/` |
| User-visible web | Module contract; both message files when text changes |
| Prisma / seed | schema, migrations, shared seed files |
| Setup / CI / ops | `operations.md`, `.env.example`, `.github/workflows/AGENTS.md` |
| Architecture map | Root or nearest `AGENTS.md` |
| How features split | `.agents/skills/life-ustc-feature` |

## Major docs

- [contracts/AGENTS.md](contracts/AGENTS.md)
- [contracts.schema.json](contracts.schema.json)
- [observability.md](observability.md)
- [rendering-and-cache.md](rendering-and-cache.md)
- [interface-hierarchy.md](interface-hierarchy.md)
- [conventions/homework-naming.md](conventions/homework-naming.md)
- [graphql/mutation-capabilities.json](graphql/mutation-capabilities.json)
- Generated OpenAPI: [`public/openapi.generated.json`](../public/openapi.generated.json)
