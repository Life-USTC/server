# Editing specifications

Read a feature with `bun run specs:show <id>` and follow its `policy_refs` to
shared requirements. Validate edits with `bun run specs:check`.

## Where an edit belongs

| Information | Owner |
|---|---|
| Product scope and feature behavior | `product.yaml`, `features/<id>.yaml` |
| Requirements shared across features | `policies/<id>.yaml` |
| Context, alternatives and consequences of a decision | `decisions/<id>.yaml` |
| Supported document shapes and expectation kinds | [schemas/](schemas/) |
| Model fields and exposed interface shapes | [Prisma](../prisma/schema.prisma), [OpenAPI](../public/openapi.generated.json), [GraphQL SDL](graphql/schema.graphql) |

For a feature example, see [homework](features/homework.yaml):
`homework.no-subscription-required` uses a prose `rule`, while
`homework.single-delete-replay` uses a typed `expectation`.

## Document semantics

- Requirement IDs are globally unique and begin with their feature/policy ID.
  Keep one owner; use `requirement_refs`, `policy_refs` and capability `refs`
  for links. `rationale` explains a requirement without adding obligations.
- A requirement uses either `rule` or typed `expectation`. Typed expectations
  also require `applies_to` and `acceptance`. Advisory policies use
  `enforcement: advisory`, `requirements: []` and `guidance`.
- Feature `applies_to` names capabilities; policy requirements name their own
  topics and link features through `refs`. `areas` is grouping, not OAuth scope.
  Surface authentication inherits from the capability unless overridden.
- Capability bindings identify REST paths/methods, GraphQL fields and MCP tools.
  Ordered UI items/filters belong in `presentation`; displayed fields belong in
  its `views` priority groups.
- Use JSON-compatible YAML 1.2 with string dates, without aliases, anchors, tags
  or duplicate keys. The schemas/checker enforce supported shapes and references.
- Source references identify exported operations in repository modules.
- Optional `acceptance.test: {file, name}` points readers to a representative
  scenario. The checker validates document structure and business references;
  it does not resolve test titles or establish behavioral coverage. The
  [acceptance decision](decisions/state-based-acceptance.yaml) explains this boundary.

Interface snapshot generation and compatibility checks: [Contributing](../CONTRIBUTING.md).
