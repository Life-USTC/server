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

## Import school catalog data locally

The static loader reads a complete curriculum SQLite snapshot. In the sibling
`static` checkout, run `uv run python main.py --course-catalog` on an existing
curriculum snapshot to add public course profiles, section profiles and catalog
relationships. A fresh public-only crawl is sufficient for inspecting those
sources in SQLite. The server loader also needs the semester, schedule and
source-coverage tables from the curriculum build.

From `server`, apply the Prisma migrations to the development database with
the migration role, then run the loader with that database's importer role.
For an isolated local database without edge cache credentials:

```sh
STATIC_SNAPSHOT_PATH=../static/build/life-ustc-static.sqlite \
ALLOW_SKIPPING_POST_IMPORT_CACHE_PURGE=true bun run static:load
```

`DATABASE_URL` selects the target database and role. Set
`STATIC_LOADER_DRY_RUN=true` to exercise the same writes in a transaction that
rolls back. Reapplying an identical snapshot reuses the committed import.

To load the published catalog, run `scripts/load-static-sqlite.sh`. The
script downloads the full compressed snapshot and decompresses it before
import. It also accepts a raw or gzip-compressed file via
`STATIC_SNAPSHOT_PATH`, or a custom download URL via `STATIC_SNAPSHOT_URL`.
For the first rollout, update the loader while Pages still serves the older
raw-only build. It falls back to that URL until the first compressed snapshot
is published. If the compatibility file for an enriched build has already
been imported, switch to the full download with the next static build.
Import state requires each build timestamp to identify one snapshot hash.

`Course.officialProfile` holds the school's course-level record, including
the localized descriptions, credits, hours, books and syllabus.
`Section.officialProfile` holds the record for that particular class.
The loader matches the school's numeric IDs and checks the course and term
for a section. A renamed code can coexist with the code in an earlier
timetable. The import log counts missing and conflicting identities. A public
class profile with no corresponding timetable section stays in SQLite until
a matching section arrives. An older snapshot without profile tables
preserves profiles already imported.

Course substitution rules retain the two ordered groups. Catalog group paths
and members preserve where a course appeared in the school directory. Study
plans retain their module tree and links to shared modules. For bulk analysis
by course code, the static snapshot also provides the expanded
`catalog_teach_program_courses` table.
