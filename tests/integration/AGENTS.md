# tests/integration/

Integration tests with in-process MCP harness.

## Shared Setup

Use the repo root `AGENTS.md` for the canonical command list, shared dev-seed flow,
and `DEV_SEED_ANCHOR` guidance. This scoped guide only adds integration-specific
notes.

## Harness

Use `tests/integration/utils/mcp-harness.ts` for the in-process authenticated
MCP client/server pair. Keep setup examples there; this guide only records
integration-specific caveats.

MCP tool coverage is split by feature into `tests/integration/mcp-*.test.ts`
and shares helpers from `tests/integration/utils/mcp-tool-test-utils.ts`.
Keep integration file parallelism disabled unless those shared seeded-user
mutations are made fully isolated.

## Conventions

- Use `DEV_SEED_ANCHOR.date` / `.recommendedAtTime` from `@tools/dev/seed/dev-seed` instead of hardcoding shared seed dates.
- Write mutations use unique markers `[integration-test] ...`
- Clean up created data within test group
- Read-only assertions against seed need no cleanup

## Relationship to Other Layers

- **Unit**: Pure functions, no DB
- **Integration**: DB required, in-process MCP
- **E2E**: Browser + built server
