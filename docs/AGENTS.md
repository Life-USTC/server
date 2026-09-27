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
bun run specs:check --complete
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

Requirements contain either a prose `rule` or a typed `expectation`, never both.
Use `expectation` for the finite kinds in `schemas/expectations.schema.json`:
input bounds, authorization cases, ordered actions, target sizes and state-based
presentation. Keep background and tradeoffs in optional `rationale`. Remove the
replaced normative text from `access`, `notes` and `presentation`; use
`requirement_refs` to reference the canonical requirement instead.

Each atomic requirement has one canonical acceptance test. `acceptance` is an
object with `given`, `when`, `then`, and a single `test: {file, name}`. The literal
test name must equal the requirement ID. A test cannot be the acceptance test
for two requirements. The checker also rejects orphan canonical tests, duplicate
names across files, disabled tests, and parameterized name templates. Split
independent behaviors into requirements before assigning tests; a named test may
exercise multiple inputs for one rule. Additional regression tests remain useful
and do not need their own specification IDs.

Feature test files stay in the appropriate runner's directory, grouped by domain.
A browser test, a database test, and a unit test have different execution needs;
the atomic requirement ID is the correspondence across these layers. Choose the
lowest layer that actually observes the entire requirement. A mocked permission
helper does not prove HTTP authentication, database isolation, or rendered UI.
Source assertions establish architecture constraints, not user-visible behavior.

Typed requirements additionally declare `applies_to` capabilities and bind
transport expectations to an actual REST method/path, GraphQL field/mutation, or
MCP tool. Read the expected values from YAML and observe the real implementation;
never compare two values both generated from the specification. Preserve intended
transport differences such as pagination defaults and duplicate-input handling.

`specs:check` validates shapes, consistency, and both directions of existing test
bindings. It explicitly reports requirements that still lack tests;
`specs:check --complete` rejects any such gap. Neither command executes tests.
`specs:coverage --enforce` requires every requirement's canonical test to pass in
native execution evidence from the same CI run. Prose and typed requirements have
the same completeness gate. A passing linked test only proves its actual
assertions, so reviewers must check that the assertion covers the entire rule.

Review the requirement itself before implementing its test: identify the user
need, scope and actors; resolve conflicting rules; separate independent outcomes;
and specify observable boundaries. Existing behavior is evidence, not the product
authority. Record explanatory tradeoffs in `rationale`. Advisory writing guidance
uses `enforcement: advisory`, `requirements: []`, and `guidance`; it is not a
mandatory behavior disguised as a requirement. Do not move real obligations into
rationale merely because they are difficult to test.

## Change a requirement

1. Identify the canonical feature, scope, noun, action and capability.
2. Update the affected feature or shared policy first. Reuse `policy_refs` for
   shared policy IDs and `refs` for `{feature, capability?}` associations.
3. Keep requirements atomic with stable globally unique IDs prefixed by the feature
   or policy ID. Use typed expectations where supported. Add a new kind only with
   a real behavioral consumer and schema/negative tests; do not build a general
   expression language. Leave requirements without adequate test evidence visible
   as gaps rather than assigning irrelevant tests.
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
