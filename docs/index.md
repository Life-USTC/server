# Documentation index

Start with [product.yaml](product.yaml), then the relevant [feature](features/)
and its referenced [policies](policies/). These describe intended behavior;
generated interface contracts describe exposed shapes, and decisions record
the reasons for architectural choices.

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
| Editing and validating specifications | [Specification authoring](specification-authoring.md) |
| Database-backed test setup and commands | [Local development](local-development.md) |
| Test layers, isolation and coverage boundaries | [Test runtime](test-runtime.md) |
| Making changes, updating interface snapshots and submitting a PR | [Contributing](../CONTRIBUTING.md) |

```bash
bun run specs:list
bun run specs:show homework
bun run specs:check
```
