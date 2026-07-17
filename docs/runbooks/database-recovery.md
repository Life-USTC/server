# Database Recovery

This runbook is the repository-side recovery gate for production database
changes such as the stale Section lifecycle migration in
[Issue #468](https://github.com/Life-USTC/server/issues/468). It does not prove
that backups or point-in-time recovery (PITR) exist. Provider-side evidence and
a successful isolated restore drill are required before
[Issue #471](https://github.com/Life-USTC/server/issues/471) can be closed.

## Hard Gate

Do not merge a production database change while its recovery prerequisite is
open. A successful CI run on `main` automatically starts DB Migrate Deploy, and
Static Sync also deploys migrations before its scheduled or manual import.

The repository can verify an isolated restored database. It cannot:

- identify the PostgreSQL provider from `DATABASE_URL` or Cloudflare Hyperdrive;
- enable provider backups or PITR;
- create a provider restore point;
- prove retention, the recoverable window, RPO, or RTO;
- replace an operator-owned rollback decision.

## Evidence Record

Record the following without credentials, connection strings, database names,
personal data, comment bodies, or description contents:

| Field | Required evidence |
|---|---|
| Provider and resource | Provider name plus a non-sensitive project/cluster alias |
| Operational owner | Accountable team or role and the operator for this change |
| Backup policy | Enabled state, retention, and provider evidence timestamp |
| PITR window | Earliest and latest recoverable timestamps |
| RPO | Declared target and the restore point selected for this change |
| RTO | Declared target and measured restore-to-verification duration |
| Candidate | Exact commit, migration name, and static snapshot SHA-256 when applicable |
| Restore point | Provider snapshot reference or PITR timestamp created immediately before the window |
| Drill | Recovery workflow run plus non-sensitive aggregate results |
| Decision | Roll forward, reversible backfill rollback, or provider restore, with the decision owner |

Provider screenshots or console links may remain in an access-controlled
operations system. Link that evidence from the issue instead of copying secrets
or production data into GitHub.

## One-Time GitHub Setup

GitHub environment protection is configured outside this repository.

1. Configure required reviewers for the existing `production` environment.
2. Create a separate `database-recovery` environment with required reviewers.
   A reviewer must confirm that the supplied full 40-character commit SHA is
   the reviewed candidate before approving the job.
3. Add only these environment secrets to `database-recovery`:
   - `RECOVERY_DATABASE_URL`: an ephemeral connection to the isolated restore,
     never production.
   - `RECOVERY_DRILL_GUARD`: a new opaque marker for this drill. It is not a
     provider credential.
4. Do not add `DATABASE_URL`, a provider API token, or production credentials to
   `database-recovery`.

Referencing an environment does not make it protected by itself. Verify the
review rules before relying on either gate.

## Restore Drill

1. Freeze the candidate commit and migration set. Record the exact static
   snapshot hash when the change imports static data.
2. Pause or coordinate all production database writers for the maintenance
   window. DB Migrate Deploy and Static Sync share the
   `production-database-writes` concurrency group. Its `queue: max` setting
   retains up to 100 pending runs in FIFO order instead of replacing an older
   pending migration with a newer sync. GitHub concurrency is still not a
   replacement for an operator-owned maintenance window.
3. Ask the provider to create a restore point immediately before the change.
   Record its UTC timestamp and the current recoverable window.
4. Restore that point into an isolated database with no application traffic.
   Use a new role and short-lived credentials.
5. Mark only the isolated database with the opaque value stored in
   `RECOVERY_DRILL_GUARD`:

   ```sql
   COMMENT ON DATABASE "<isolated-database-name>"
   IS 'life-ustc-recovery-drill:<opaque-marker>';
   ```

   Never put a URL, credential, provider resource ID, or personal data in the
   comment. Never set this marker on production.
6. Manually run **Recovery Drill Verify** with the frozen candidate's full
   40-character commit SHA and a valid `YYYY-MM-DDTHH:MM:SSZ` restore point.
   Branches, tags, and abbreviated SHAs are rejected. The
   workflow:
   - refuses to continue unless the database comment matches the environment
     marker;
   - collects a read-only aggregate baseline;
   - deploys the candidate migrations to the isolated restore;
   - repeats the read-only checks;
   - fails if any allowlisted count changes or any orphan violation is nonzero;
   - writes only aggregate JSON to the job summary and uploads no artifact.
7. Record provider restore start, database-ready, migration-complete, and
   verification-complete timestamps. Compare measured recovery time with the
   declared RTO and the selected restore point with the declared RPO.
8. Link the provider evidence and workflow run from #471. Keep #471 open if any
   provider fact, integrity check, RPO, RTO, or rollback owner is missing.

The verifier covers aggregate counts for Sections, Comments, Descriptions,
Homeworks, user-to-Section calendar subscriptions, Schedules, Exams, and
teacher relations. It reports only counts and orphan violations; it never
selects user fields or content.

## Production Rollout

After #471 is complete:

1. Approve the production environment only for the frozen candidate.
2. Record before counts and confirm the provider restore point is still within
   the PITR window.
3. Apply the migration and reversible backfill.
4. Confirm no Section or child row was hard-deleted and run the documented
   after-count checks.
5. Confirm that re-importing a Section clears retirement as specified by #468.

## Rollback Decision

- If the database is healthy and only lifecycle flags are wrong, stop the
  importer and use the reviewed reversible backfill to clear the flags. Prefer
  this over a whole-database restore.
- If rows or relationships were destructively corrupted, stop all writers,
  record the failure timestamp, and invoke the provider restore procedure.
  Account explicitly for writes after the selected restore point.
- The operational owner decides whether measured data loss and recovery time
  remain within RPO/RTO. GitHub Actions must not make that decision.

Do not upload `pg_dump`, production query results, or restore images as GitHub
artifacts. A local or CI PostgreSQL test proves migration mechanics only; it is
not provider PITR evidence.
