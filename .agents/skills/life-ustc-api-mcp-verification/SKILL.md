---
name: life-ustc-api-mcp-verification
description: "Verify Life-USTC REST API and MCP behavior after route, tool, contract, OpenAPI, auth, permission, status, pagination, date, or output-shape changes."
---

# Life USTC API MCP Verification

## Overview

Use this skill to verify public API and MCP behavior by inspecting representative serialized outputs, not only internal helper return values.

## Workflow

1. Read root `AGENTS.md`, `docs/contracts/AGENTS.md`, and `src/lib/mcp/AGENTS.md` when MCP is involved.
2. Identify the coupled surfaces: route handler, MCP tool, feature/server function, contract JSON, OpenAPI annotation, seed data, and tests.
3. Decide REST/MCP parity explicitly. If only one surface changes, record why the other stays unchanged in the PR body or final handoff.
4. Pick representative public calls. Cover at least one success shape and one relevant validation, auth, permission, or not-found path when those behaviors changed.
5. Exercise the route or MCP tool through the narrowest realistic public surface.
6. Inspect the serialized status/body or `jsonToolResult` output and compare it with contracts, OpenAPI, and tests.
7. Add or update tests where behavior is observed.
8. Remove temporary probes, logs, scripts, and copied payloads before committing.

## REST Checks

- Prefer focused route tests or Playwright API request tests when they already exist.
- When a local server is needed, use the repo setup from `AGENTS.md`; seed first for data-backed cases.
- Inspect HTTP status, response body, response headers when relevant, date serialization, pagination metadata, and localized fields.
- Redact bearer tokens, session cookies, OAuth codes, upload URLs, and personal data from terminal output and PR text.
- Compare public response shape with route OpenAPI JSDoc and `docs/contracts/openapi.json` when applicable.

## MCP Checks

- Prefer existing integration specs and helpers under `tests/integration/`.
- Use the in-process MCP harness instead of calling route handlers directly.
- Inspect the serialized tool result, including `mode` behavior, date serialization, compaction, auth failure shape, and permission handling.
- Compare input schema, tool description, output shape, and permissions with the matching `docs/contracts/<module>.json` and `docs/contracts/mcp.json`.
- Preserve MCP auth differences: bearer only, audience `/api/mcp`, user id from SDK auth info.

## Local Checks

Use the highest relevant gate:

- Focused unit or integration spec for the changed route/tool.
- `bun run verify` for most API/MCP work.
- `bun run verify:full` for auth, data, browser, docs contracts, or shared tooling changes.
- `bun run build` when OpenAPI generation, Worker packaging, or production build output is affected.

## Handoff Evidence

Summarize the representative call or tool exercised, the status/result shape inspected, contracts/tests updated, commands run, and any skipped output checks with the reason.
Include the REST/MCP parity decision when only one public surface changed.
