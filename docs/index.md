# Documentation Index

`AGENTS.md` is the canonical agent instruction surface. This index is the
project map.

## Start Here

- [Root agent guide](../AGENTS.md)
- [Repo skills](../.agents/skills/) — `$life-ustc-dev-loop` is the check/test SSOT
- [README](../README.md) — product overview (capabilities and surfaces)
- [Operations](operations.md) — production auth DB, Workers Builds, cleanup jobs
- [Dev loop skill](../.agents/skills/life-ustc-dev-loop/SKILL.md) — local setup and checks
- [Contracts](contracts/)
- [Interface hierarchy](interface-hierarchy.md)

## Read by Task

| Task | Read first |
|------|------------|
| Understand the system | [AGENTS.md](../AGENTS.md), then nearest scoped `AGENTS.md` |
| PR/check loop | `$life-ustc-pr-workflow` |
| Change a feature | `docs/contracts/<module>.json`, then `src/features/` |
| UI / layout | `$life-ustc-dev-loop` UI gate + affected Playwright spec |
| REST | route handler, OpenAPI JSDoc, `docs/contracts/openapi.json` |
| GraphQL | module contract, `graphql.json`, SDL snapshot, resolver tests |
| MCP | `src/lib/mcp/AGENTS.md`, tool handler, module contract |
| Data shape | `prisma/schema.prisma` + migrations |
| Setup / ops | [README](../README.md), [operations.md](operations.md), [observability.md](observability.md) |

## Keep In Sync

| Change area | Update |
|-------------|--------|
| Public REST shape/status | Route OpenAPI JSDoc; `docs/contracts/openapi.json` when coverage changes; `bun run openapi:check` |
| GraphQL field/budget/schema | Module contract; `graphql.json`; SDL snapshot + tests |
| MCP tool/auth/output | Module contract; `tests/integration/` |
| User-visible web behavior | Module contract; both message files when text changes |
| Prisma / seed | schema, migrations, shared seed files |
| Setup / CI / ops | README, `operations.md`, `.env.example`, `.github/workflows/AGENTS.md` |
| Architecture / agent mistakes | Nearest `AGENTS.md` or `.agents/skills` |

## Major Docs

- [contracts/AGENTS.md](contracts/AGENTS.md) — contract JSON workflow
- [contracts.schema.json](contracts.schema.json)
- [observability.md](observability.md)
- [rendering-and-cache.md](rendering-and-cache.md)
- [interface-hierarchy.md](interface-hierarchy.md)
- [conventions/homework-naming.md](conventions/homework-naming.md)
- [graphql/mutation-capabilities.json](graphql/mutation-capabilities.json)
- Generated OpenAPI: [`public/openapi.generated.json`](../public/openapi.generated.json)

## Verification

Use `$life-ustc-dev-loop`. Core aliases: `bun run app:prepare`, `bun run build`,
`bun run dev`, `bun run e2e:server`. OpenAPI: `bun run openapi:check`. GraphQL
SDL: `bunx vitest run --update tests/unit/graphql-schema-snapshot.test.ts`.
