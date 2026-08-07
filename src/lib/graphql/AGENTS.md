# src/lib/graphql/

Explicit public GraphQL transport and schema infrastructure.

## Boundaries

- Keep the SDL explicit; do not expose Prisma models or generate CRUD automatically.
- Resolvers call `src/features/*/server` services directly. They do not call REST/MCP routes, make loopback HTTP requests, or query Prisma.
- Public `catalog` (and public `community` reads) stay anonymous. Personal queries live under `workspace` / `account` and return null without a trusted session or GraphQL-audience OAuth token; each field enforces its feature read scope. Trusted-origin Sessions retain normal user authority.
- Personal collection services derive ownership from `userId` relations. Never expose trusted `sectionIds`, deleted/editor/shape switches, or other transport-internal flags as GraphQL inputs.
- A GraphQL object must have the same observable field shape whether returned by a list or detail query.

## Runtime and security

- Keep one `graphql` runtime version compatible with Yoga and every Envelop plugin.
- Every collection is capped or uses `PageInput`; enforce request size, batching, depth, cost, alias, directive, token, top-level-field, and timeout limits in `server.ts` and `security.ts`. Cost weights paginated selections by effective `pageSize`.
- `DateTime` inputs require ISO 8601 with an explicit timezone (variables and literals).
- Normalize schedule/exam `@db.Date` filters to the Asia/Shanghai calendar day after strict coercion.
- DataLoaders request-scoped; production errors masked; production introspection off; `Cache-Control: no-store`.
- Personal mutations use the same `feature:write` scope and per-user mutation rate-limit key as REST and MCP.

## Contracts

- Schema change updates `docs/contracts/<module>.json`, `docs/contracts/graphql.json`, and `docs/graphql/schema.graphql`.
- Regenerate with `bunx vitest run --update tests/unit/graphql-schema-snapshot.test.ts`, then rerun without `--update`.
- MCP may execute documents only through the shared production Yoga pipeline; require confirmation for mutations.

Root Commands: `AGENTS.md`. Feature split: `$life-ustc-feature`.
