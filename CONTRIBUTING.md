# Contributing

Start with the [README quick start](README.md#quick-start).
[Local development](docs/local-development.md) covers the separate database and
role setup for integration, Worker HTTP, and browser tests;
[test runtime and fixtures](docs/test-runtime.md) explains which layer to use.
Commands are defined in [package.json](package.json); `bun run check` runs the
static, type, specification, unit, and generated OpenAPI checks.

## Behavior and specifications

Business operations live in `src/features/<domain>/server`; REST, GraphQL, MCP,
and Web expose those operations through their respective adapters.
The [documentation index](docs/index.md) locates feature behavior and shared
policies. For a behavior change, update the affected requirements alongside the
implementation; [specification authoring](docs/specification-authoring.md)
explains the YAML vocabulary and validation.

## API contracts

REST route declarations generate [OpenAPI](public/openapi.generated.json):

```bash
bun run openapi:generate
bun run openapi:check
```

Generation updates the tracked artifact; the check compares it with the generated
document without changing files or depending on Git staging. The application
build also regenerates OpenAPI.

For GraphQL behavior changes, update affected requirements, including
[graphql.yaml](docs/features/graphql.yaml) where applicable. When the executable
schema changes, regenerate the [SDL snapshot](docs/graphql/schema.graphql):

```bash
bunx vitest run --update tests/unit/lib/graphql/graphql-schema-snapshot.test.ts
bunx vitest run tests/unit/lib/graphql/graphql-schema-snapshot.test.ts
```

The [OpenAPI](.github/workflows/openapi-compatibility.yml) and
[GraphQL](.github/workflows/graphql-compatibility.yml) PR jobs compare contracts
with the base branch. Their intentional-breaking-change labels are
`api-breaking-approved` and `graphql-breaking-approved`; these waive base
compatibility, not validation of the current contract.

## Pull requests

Use the [PR template](.github/PULL_REQUEST_TEMPLATE.md) to explain the behavior
change, validation results, and applicable compatibility or migration concerns.
The [CI workflow](.github/workflows/ci.yml) runs on pull requests; its jobs and
the compatibility workflows provide the review checks.
