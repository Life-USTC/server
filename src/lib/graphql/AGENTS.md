# src/lib/graphql/

Explicit public GraphQL transport and schema infrastructure.

## Boundaries

- Keep the SDL explicit; do not expose Prisma models or generate CRUD automatically.
- Resolvers call `src/features/*/server` services directly. They do not call REST/MCP routes, make loopback HTTP requests, or query Prisma.
- Phase 1 is anonymous, public, and read-only. Viewer fields, OAuth resource handling, and mutations belong to later phases.
- A GraphQL object must have the same observable field shape whether returned by a list or detail query.

## Runtime and Security

- Keep one `graphql` runtime version compatible with Yoga and every Envelop plugin. A duplicate GraphQL module realm breaks schema inspection and MCP resources.
- Every collection is explicitly capped or uses `PageInput`; keep request size, batching, depth, cost, alias, directive, token, top-level-field, and timeout limits enforced in `server.ts` and `security.ts`.
- `DateTime` inputs require an ISO 8601 timestamp with an explicit timezone, with identical coercion for variables and inline literals.
- Keep DataLoaders request-scoped, production errors masked, production introspection disabled, and responses `Cache-Control: no-store`.

## Contracts and Verification

- A schema change updates the affected `docs/contracts/<module>.json`, `docs/contracts/graphql.json`, and `docs/graphql/schema.graphql`.
- Regenerate intentionally with `bunx vitest run --update tests/unit/graphql-schema-snapshot.test.ts`, then rerun that test without `--update`; never hand-edit the SDL snapshot.
- Keep contract Query/Mutation names and return types aligned with the SDL parity test.
- Verify protocol helpers with unit tests, public queries/security with real PostgreSQL integration tests, MCP SDL resources through the in-process MCP harness, and `/api/graphql` through the Cloudflare Worker Playwright smoke test.
- MCP may expose the SDL and persisted-operation manifest as resources. Do not add arbitrary GraphQL execution.
