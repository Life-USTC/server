# Structured specifications

Use YAML for product, feature, policy, decision, and reference data. Markdown
stays limited to navigation and contributor/tool instructions. Each specification
has `kind`, `id`, and `title`; its schema is in `docs/schemas/`.

| Kind | Location | Responsibility |
|---|---|---|
| product | `docs/product.yaml` | Product priorities, roles, vocabulary |
| feature | `docs/features/*.yaml` | Feature requirements, capabilities, permissions, surfaces, display |
| policy | `docs/policies/*.yaml` | Shared behavior, hierarchy, access and design rules |
| decision | `docs/decisions/*.yaml` | Actual context, choice and consequences |
| reference | `docs/reference/*.yaml` | Structured interface reference data |

## Read and validate

```bash
bun run specs:list
bun run specs:show homework
bun run specs:check
rg '^model |^enum ' prisma/schema.prisma
```

The specification commands read structured data. Models and enums remain in
Prisma; public wire shapes remain in OpenAPI and the GraphQL SDL.

## Change a requirement

1. Identify the canonical feature, scope, noun, action and capability.
2. Update the affected feature or shared policy first. Reuse `policy_refs` for
   shared policy IDs and `refs` for `{feature, capability?}` associations.
3. Keep requirements atomic with stable local IDs, categories and a concrete
   rule. Use structured fields for mappings and examples; do not embed a whole
   Markdown document in a string.
4. Implement through `$life-ustc-implement`, updating supported Web, REST,
   GraphQL and MCP surfaces, message files and public schemas together.
5. Verify ownership, OAuth scopes, effects, error semantics, pagination, Shanghai
   date boundaries, freshness and retry behavior on affected surfaces. Run
   `bun run specs:check` and the relevant root-AGENTS checks.
6. Check links and instructions for drift. Remove superseded requirements and
   completed implementation plans; preserve useful decisions with their actual
   rationale. Git retains implementation history.

Model references name real Prisma models; describe DTOs in return shapes.
Keep short user-visible field/filter lists in display data. Use the schema's
surface status shorthand when a surface has no entries. A surface entry inherits
its capability authentication unless it explicitly overrides it.

Bot and CLI integration contracts are verified in their own repositories.
OpenAPI synchronization alone does not prove command registration, filter flags,
table fields, dynamic MCP discovery, help text or private/shared-conversation
policy. Compare generated content before updating a pinned server revision:
an older revision can still contain identical OpenAPI.

Do not add compatibility copies, unvalidated specification keys, production
runbooks or internal environment defaults. Keep executable test payloads under
`tests/fixtures/`, and implementation steps in the task rather than a durable
second product specification.
