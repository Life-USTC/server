# Documentation index

Requirements live in YAML; [schemas](schemas/) validate their structure and the
specification checker validates references. Start with [product.yaml](product.yaml),
then the relevant [feature](features/) and its referenced [policies](policies/).

| Need | Read |
|---|---|
| Feature behavior, scope, permissions, fields, surfaces | [features/](features/) |
| Canonical names and cross-surface parity | [interface-hierarchy](policies/interface-hierarchy.yaml) |
| Display hierarchy and shared UI | [ui](policies/ui.yaml), [permission-ui](policies/permission-ui.yaml) |
| Public SSR, personal overlays, caching | [rendering-and-cache](policies/rendering-and-cache.yaml) |
| Edge cases spanning features | `policies/cases.*.yaml` |
| Audit events and retention | [audit](policies/audit.yaml) |
| Homework writing guidance | [homework-naming](policies/homework-naming.yaml) |
| Why a retained architectural choice was made | [decisions/](decisions/) |
| GraphQL mutation coverage | [mutation-capabilities](reference/mutation-capabilities.yaml) |
| GraphQL SDL | [schema.graphql](graphql/schema.graphql) |
| Generated REST contract | [openapi.generated.json](../public/openapi.generated.json) |
| Models and enums | [schema.prisma](../prisma/schema.prisma) |
| Editing and validating specifications | [docs/AGENTS.md](AGENTS.md) |
| Implementation and local checks | [root AGENTS.md](../AGENTS.md), [implementation skill](../.agents/skills/life-ustc-implement/SKILL.md) |

```bash
bun run specs:list
bun run specs:show homework
bun run specs:check
```

Generated OpenAPI and GraphQL snapshots remain interface artifacts, not duplicate
product requirements. Build regenerates OpenAPI; `bun run openapi:check` detects
drift. Intentional breaking changes require `api-breaking-approved` or
`graphql-breaking-approved` respectively; approving compatibility checks does
not disable validation of the current generated contracts.

Production monitoring, role grants, and deploy runbooks are not published here.
