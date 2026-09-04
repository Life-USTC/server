# src/lib/graphql/

Explicit public GraphQL transport and schema.

## Boundaries

- Keep the SDL explicit; don't expose Prisma models or auto-generate CRUD.
- Resolvers call `src/features/*/server` directly — not REST/MCP routes, loopback
  HTTP, or Prisma.
- Public `catalog` (and public `community` reads) stay anonymous. Personal queries
  live under `workspace` / `account` and return null without a trusted session or
  GraphQL-audience OAuth token; each field checks its feature read scope.
- Derive ownership from `userId` relations. Never expose trusted `sectionIds`,
  deleted/editor/shape switches, or other transport-internal flags as inputs.
- A GraphQL object must look the same whether returned from a list or a detail query.

## Runtime and security

- One `graphql` runtime version compatible with Yoga and every Envelop plugin.
- Cap collections or use `PageInput`; enforce size / batching / depth / cost /
  alias / directive / token / top-level-field / timeout limits in `server.ts` and
  `security.ts`. Cost weights paginated selections by effective `pageSize`.
- `DateTime` inputs need ISO 8601 with an explicit timezone.
- Normalize schedule/exam `@db.Date` filters to the Asia/Shanghai calendar day.
- Request-scoped DataLoaders; mask production errors; disable production
  introspection; `Cache-Control: no-store`.
- Personal mutations use the same `feature:write` scope and per-user rate-limit
  key as REST and MCP.

## Mutations layout

Mutation typedefs and resolvers live under `mutations/` (`todos`, `homeworks`,
`subscriptions`, `comments`, `uploads`, `descriptions`, `bus`, `links`,
`shared`, `index`). `schema.ts` still imports `graphqlMutationTypeDefs` /
`graphqlMutationResolvers` from `./mutations`.

## Contracts

- Schema changes update `docs/contracts/<module>.json`, `graphql.json`, and
  `docs/graphql/schema.graphql`.
- Regenerate with `bunx vitest run --update tests/unit/graphql-schema-snapshot.test.ts`,
  then rerun without `--update`.
- MCP may run documents only through the shared production Yoga pipeline; require
  confirmation for mutations.
