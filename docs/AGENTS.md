# Structured specifications

Use YAML for product, feature, policy, decision, and reference data. Markdown
stays limited to navigation and contributor/tool instructions. Each specification
has `kind`, `id`, and a `name` (feature) or `title`; its schema is in `docs/schemas/`.

| Kind | Location | Responsibility |
|---|---|---|
| product | `docs/product.yaml` | Product priorities, roles, vocabulary |
| feature | `docs/features/*.yaml` | Feature requirements, capabilities, permissions, surfaces, display |
| policy | `docs/policies/*.yaml` | Shared behavior, hierarchy, access and design rules |
| decision | `docs/decisions/*.yaml` | Actual context, choice and consequences |
| mutation-capabilities | `docs/reference/*.yaml` | Structured interface reference data |

## Read and validate

```bash
bun run specs:list
bun run specs:show homework
bun run specs:check
rg '^model |^enum ' prisma/schema.prisma
```

The `areas` field groups documents; it does not create an OAuth scope or API namespace.
The specification commands read structured data. Models and enums remain in
Prisma; public wire shapes remain in OpenAPI and the GraphQL SDL.

## Parsing and verification

Sources use one YAML 1.2 mapping per `.yaml` file with string keys and
JSON-compatible values. Duplicate keys, anchors, aliases, merge keys, explicit
tags, non-finite numbers and unsafe integers are rejected. Dates are strings.
Schema validation rejects unknown fields; reference checks reject duplicate IDs,
missing policies, features, capabilities, topics and test declarations.

Acceptance scenarios use `id`, `given`, `when`, and a `then` list. Optional
`tests` entries contain a repository-relative `file` and the exact literal
`name` passed to an enabled `it` or `test` declaration. These links establish
traceability, not execution or proof of coverage. Run the linked suites and
review the assertions; do not invent scenarios or bindings just to increase counts.

## Change a requirement

1. Identify the canonical feature, scope, noun, action and capability.
2. Update the affected feature or shared policy first. Reuse `policy_refs` for
   shared policy IDs and `refs` for `{feature, capability?}` associations.
3. Keep requirements atomic with stable globally unique IDs prefixed by the feature or policy ID, categories and a concrete
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

Model references name real Prisma models; wire types remain in generated OpenAPI
and SDL. Keep ordered user-visible items and filters in `presentation` data. Use the schema's
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
