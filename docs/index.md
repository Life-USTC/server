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
| Implementation, checks, and delivery | [root AGENTS.md](../AGENTS.md) |

```bash
bun run specs:list
bun run specs:show homework
bun run specs:check
```

Requirements and tests are synchronized by human review. Optional
`acceptance.test` references identify representative scenarios; they are not
machine-enforced coverage bindings. Tests may cover multiple requirements and
requirements may need multiple scenarios. The checker validates schema and
business references without interpreting test names or execution reports.

Acceptance tests separate mutations, consumers and selected complete journeys.
Independent observations verify persisted effects; consumer tests start from
known state; connection tests verify refresh, cache and cross-interface behavior.
Passing runner jobs proves those assertions passed, not that all requirements or
possible behaviors are covered. See [editing specifications](AGENTS.md) and
[test conventions](../tests/AGENTS.md) for review and isolation rules.

Generated OpenAPI and GraphQL snapshots remain interface artifacts, not duplicate
product requirements. Build regenerates OpenAPI; `bun run openapi:check` detects
drift. Intentional breaking changes require `api-breaking-approved` or
`graphql-breaking-approved` respectively; approving compatibility checks does
not disable validation of the current generated contracts.

Production monitoring, role grants, and deploy runbooks are not published here.
