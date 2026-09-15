# Documentation Index

Start with root [`AGENTS.md`](../AGENTS.md). For an end-to-end change, use
[`$life-ustc-implement`](../.agents/skills/life-ustc-implement/SKILL.md).

## Start here

- [AGENTS.md](../AGENTS.md) — layout and local checks
- [README](../README.md) — product overview
- [Contracts](contracts/)
- [Interface hierarchy](interface-hierarchy.md)
- [Rendering and cache](rendering-and-cache.md) — which pages may be anonymously cached

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
| Weather / young events / news | Module contracts `weather.json`, `young-event.json`, `publications.json` |
| Env / CI | `.env.example`, `.github/workflows/AGENTS.md` |

## Keep in sync

| Change area | Update |
|-------------|--------|
| Public REST | Route OpenAPI JSDoc; `openapi.json` when coverage changes; `bun run openapi:check` |
| GraphQL | Module contract; `graphql.json`; SDL snapshot + tests |
| MCP | Module contract; `tests/integration/` |
| User-visible web | Module contract; both message files when text changes |
| Prisma / seed | schema, migrations, shared seed files |
| Setup / CI | `.env.example`, `.github/workflows/AGENTS.md` |
| Layout / boundaries | Root or nearest `AGENTS.md` |
| How to split a change | `.agents/skills/life-ustc-implement` |

## Major docs

- [contracts/AGENTS.md](contracts/AGENTS.md)
- [contracts.schema.json](contracts.schema.json)
- [rendering-and-cache.md](rendering-and-cache.md)
- [interface-hierarchy.md](interface-hierarchy.md)
- [conventions/homework-naming.md](conventions/homework-naming.md)
- [graphql/mutation-capabilities.json](graphql/mutation-capabilities.json)
- Generated OpenAPI: [`public/openapi.generated.json`](../public/openapi.generated.json)

`bun run build` regenerates the deployed OpenAPI document. Commit that generated
snapshot and use `bun run openapi:check` as the clean-tree drift gate. Pull
requests with an intentional breaking change require the
`api-breaking-approved` label. Intentional GraphQL breaking changes require the
separate `graphql-breaking-approved` label. Both canonical generated contracts
remain checked even when their base-compatibility gate is approved.

Production monitoring, role grants, and deploy runbooks are **not** published in
this repository.
