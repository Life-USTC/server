# docs/contracts/

Modular product/API/MCP contracts stored as formatted JSON.

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

## Workflow

When behavior, API, MCP, parameters, or outputs change:

1. Update the affected `docs/contracts/<module>.json` first.
2. Implement code changes.
3. Run the check sequence from `$life-ustc-dev-loop` to validate the merged contract against schema, Prisma, REST, and MCP checks.
4. Update relevant tests.

If the user did not explicitly ask for documentation changes, ask before broad restructures or rewrites and keep any required doc edits tightly scoped.

## Queries

```bash
# Single module
jq '.capabilities | keys' docs/contracts/homework.json
jq '.rules' docs/contracts/user.json

# Models and enums
rg '^model ' prisma/schema.prisma
rg '^enum ' prisma/schema.prisma

# All modules
find docs/contracts -maxdepth 1 -type f -name '*.json' ! -name '_*.json' -exec basename {} .json \; | sort
```

## Module Shape

Each module file contains:
- `name`
- `access`
- `rules`
- `capabilities`

Keep module files focused. Shared UI, case, and audit metadata stays in the `_*.json` files; model and enum shape stays in `prisma/schema.prisma`.
