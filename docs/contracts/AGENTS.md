# docs/contracts/

Modular product/API/MCP contracts as formatted JSON.

## Structure

```text
Shared metadata
  _meta.json       Product metadata and query examples
  _product.json    Roles, workflow, display conventions
  _ui.json         UI pattern library
  _cases.json      Edge cases and scenarios
  _audit.json      Audit actions

Contract modules
  <module>.json
```

## When behavior changes

1. Update the affected `docs/contracts/<module>.json` first.
2. Implement via `$life-ustc-feature` (use-case + transports + tests).
3. Validate with root `AGENTS.md` Commands (`openapi:check`, GraphQL SDL
   snapshot, integration) for the surfaces you touched.

## Queries

```bash
jq '.capabilities | keys' docs/contracts/homework.json
jq '.rules' docs/contracts/user.json
rg '^model ' prisma/schema.prisma
find docs/contracts -maxdepth 1 -type f -name '*.json' ! -name '_*.json' -exec basename {} .json \; | sort
```

## Module shape

Each module has `name`, `access`, `rules`, `capabilities`. Shared UI/case/audit
metadata stays in `_*.json`; model/enum shape stays in `prisma/schema.prisma`.
