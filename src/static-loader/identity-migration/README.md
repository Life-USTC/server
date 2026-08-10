# Raw jwId migration planner

This folder contains the deterministic planner plus the dedicated snapshot
reader and transactional executor. The planner itself remains pure; the CLI
pins one SQLite file by SHA-256 and applies the resulting plan to PostgreSQL.
The migration reads the fixed snapshot's complete history because existing
production rows may predate the runtime loader's minimum-semester boundary.

The planner enforces an expand/data/contract boundary: legacy unique identities
such as `Department.code` and `ExamBatch.nameCn` must remain enforced while raw
`jwId` values and source-backed edges are backfilled. Dropping those constraints
before the data transaction would allow the runtime loader to create a second
row for the same legacy identity. The contract migration may remove them only
after the planner's mappings have committed and its invariants have passed.

Every new or changed target must exist in that fixed snapshot. The sole
exception is a single raw `CourseAlias` recorded by the retired loader for a
synthetic Course whose source row has since disappeared; the migration restores
that recorded upstream `jwId` and deletes the alias table's contents.
Teacher titles are assignment-level source data: the planner only emits a title
edge when the snapshot proves it for the exact section/teacher assignment; it
never copies a legacy Teacher title by name or by convenience.

An existing non-synthetic `jwId` remains authoritative for historical rows no
longer returned by the current snapshot. Name-only Teacher rows have no source
identity: rows without UGC and their unprovable assignments are removed, while
UGC on such a row blocks the migration.

Comments can be rebound when multiple legacy rows converge on one raw target.
Descriptions are unique per target, so non-empty descriptions may converge only
when their content fingerprints are identical; different fingerprints produce a
`DESCRIPTION_CONFLICT`. Empty descriptions do not conflict with user content.

The migration entrypoint is `bun run static:migrate-identities`. It requires
`STATIC_SNAPSHOT_PATH` and an explicit
`STATIC_IDENTITY_MIGRATION_EXPECTED_SNAPSHOT_SHA256`; dry-run defaults to true.
Dry-run opens a PostgreSQL `SERIALIZABLE READ ONLY` transaction. Apply uses the
same static-loader advisory lock and one serializable transaction for planning,
transactional legacy-index removal, edge/UGC migration, and the final
`raw-jwid-v1` completion record. It never invokes the normal static import.

Teacher schedule and assignment edges are source-backed. A schedule teacher is
resolved only when the fixed snapshot proves one raw teacher within that
section. Assignment titles additionally require the assignment-title schema;
the executor fails closed when that schema has not landed.

Course provenance recognizes both retired synthetic namespaces: the original
`sha256("course:" + code)` ID and the later semantic-variant ID. Collisions map
to multiple raw targets and therefore block any ambiguous UGC. Department codes
that do not exist in the authoritative tree remain code-only placeholders with
`jwId = NULL`; their unique code constraint and existing references are kept.
Campus splits rebuild Building and Section edges from raw snapshot campus IDs.
