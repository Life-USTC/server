# Documentation Index

Start with root [`AGENTS.md`](../AGENTS.md). For an end-to-end change, use
[`$life-ustc-implement`](../.agents/skills/life-ustc-implement/SKILL.md).
Git / PR / CI / merge: global agent skills.

## Start here

- [AGENTS.md](../AGENTS.md) — layout and local checks
- [README](../README.md) — product overview
- [Operations](operations.md)
- [Contracts](contracts/)
- [Interface hierarchy](interface-hierarchy.md)

## Read by task

| Task | Read first |
|------|------------|
| Find your way around | Nearest `AGENTS.md` under the folder you are editing |
| Add or change behavior | `$life-ustc-implement`, then `docs/contracts/<module>.json` |
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
| Layout / boundaries | Root or nearest `AGENTS.md` |
| How to split a change | `.agents/skills/life-ustc-implement` |

## Major docs

- [contracts/AGENTS.md](contracts/AGENTS.md)
- [contracts.schema.json](contracts.schema.json)
- [observability.md](observability.md)
- [rendering-and-cache.md](rendering-and-cache.md)
- [interface-hierarchy.md](interface-hierarchy.md)
- [conventions/homework-naming.md](conventions/homework-naming.md)
- [graphql/mutation-capabilities.json](graphql/mutation-capabilities.json)
- Generated OpenAPI: [`public/openapi.generated.json`](../public/openapi.generated.json)
