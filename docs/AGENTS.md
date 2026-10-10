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
missing policies, features, capabilities and topics.

Requirements contain either a prose `rule` or a typed `expectation`, never both.
Use `expectation` for the finite kinds in `schemas/expectations.schema.json`:
input bounds, authorization cases, ordered actions, target sizes and state-based
presentation. Domain contracts in `schemas/domain-expectations.schema.json` cover
bounded state transitions, transaction effects, public projections, ordered pages,
reminder windows and their supported authorization/presentation cases. Add a kind
only when a real production observation can validate it end to end. Keep background and tradeoffs in optional `rationale`. Remove the
replaced normative text from `access`, `notes` and `presentation`; use
`requirement_refs` to reference the canonical requirement instead.

Documentation and tests are synchronized manually. `acceptance` records `given`,
`when`, and `then`; its optional `test: {file, name}` is an editorial pointer to a
representative scenario, not an executable binding or coverage claim. Several
requirements may refer to one scenario, and one requirement can need checks in
several test layers. Test names do not need to equal requirement IDs. Reviewers
check that the affected requirements and assertions agree, including supporting
scenarios beyond the representative pointer.

Policy topics may use `requirement_refs` to index the actual owners of cross-feature contracts.
A topic reference does not create another requirement or prove test coverage; avoid
duplicating an umbrella requirement when every obligation already has a specific owner.

Feature test files stay in the appropriate runner's directory, grouped by domain.
Use independent mutation and consumer cases, each with its own prepared state.
Keep promised refresh, cache and asynchronous checks in their owning modules;
do not require duplicate cross-entrypoint or complete-journey layers. See
`tests/AGENTS.md` for the isolation and oracle rules.
A mocked permission helper does not prove HTTP authentication, database isolation,
or rendered UI. Source assertions establish architecture constraints, not
user-visible behavior.

Typed feature requirements declare `applies_to` capability IDs; policy requirements
declare their own topic IDs and use the policy's `refs` for feature/capability links.
Transport references name the actual REST method/path, GraphQL field/mutation or
MCP tool. Preserve intended transport differences such as pagination defaults,
error responses and duplicate-input handling.

`specs:check` validates schema, consistency and authoritative business references.
Source references resolve exported operations; public projection paths resolve
OpenAPI properties; ordered model fields resolve Prisma. Existence is not runtime
correctness. This command does not scan test declarations, enforce one-to-one
mapping, or establish acceptance completeness. Ordinary runner results decide
whether tests pass; reviewers decide whether their observations cover the intended
requirements.

Tests keep their expected outcomes independent of runtime specification
loading. Shared assertion utilities observe actual behavior and take explicit
expected values from the test. Do not add a receipt, test-owner registry or
specification-consumption system. Never compare expectations with themselves or derive both expected and
observed results from the same production operation.

CI must run the unit, integration, REST, role-isolation and browser partitions,
plus static and build checks. The protected check named Specification execution
evidence aggregates those job results; `Source / Checks` validates document structure.
Passing these jobs establishes execution success,
not exhaustive requirements coverage. Retain runner reports and failed browser
traces for review.

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
   a concrete domain need and schema/negative tests; do not build a general
   expression language. Review missing behavioral checks explicitly rather than
   assigning an irrelevant representative test.
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
