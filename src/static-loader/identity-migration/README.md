# Raw jwId migration planner

This folder contains only deterministic planning code. It does not read SQLite,
connect to PostgreSQL, or apply mutations.

The planner enforces an expand/data/contract boundary: legacy unique identities
such as `Department.code` and `ExamBatch.nameCn` must remain enforced while raw
`jwId` values and source-backed edges are backfilled. Dropping those constraints
before the data transaction would allow the runtime loader to create a second
row for the same legacy identity. The contract migration may remove them only
after the planner's mappings have committed and its invariants have passed.

Every planned entity and edge target must exist in that fixed snapshot. A stale
`CourseAlias` is a blocker, never a target. Teacher titles are assignment-level
source data: the planner only emits a title edge when the snapshot proves it for
the exact section/teacher assignment; it never copies a legacy Teacher title by
name or by convenience.

Comments can be rebound when multiple legacy rows converge on one raw target.
Descriptions are unique per target, so non-empty descriptions may converge only
when their content fingerprints are identical; different fingerprints produce a
`DESCRIPTION_CONFLICT`. Empty descriptions do not conflict with user content.
