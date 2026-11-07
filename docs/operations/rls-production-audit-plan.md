# Issue #601: production role metadata and importer identity audit

This plan separates metadata collection from production identity verification and the importer transition. The validation recorded here uses explicitly owned disposable databases. A production collection run needs a separate reviewed manual dispatch; permission and credential transitions require explicit approval. Issue #601 remains open until its full acceptance criteria are met.

The Issue already records a deployed Worker configuration readback mapping app/auth/maintenance bindings to their three restricted role names. That is configuration evidence; production role flags, effective privileges and connection-session identities still need independent observations. The earlier historical postgres binding is not asserted to be current.

The existing Static Sync workflow uses `MIGRATOR_DATABASE_URL` both for migrations and snapshot loading. The restricted importer implementation was delivered in #1372; a production importer credential is still unproven and no `IMPORTER_DATABASE_URL` Secret is available in the reported configuration. #1498 adds collaborative policy inventory checks to the local runtime preflight. Those checks establish the disposable-database contract and leave production identity/permissions as separate work.

## Collector and execution contract

- `scripts/operations/rls-metadata-audit.sql`: one bounded JSON inventory from `pg_catalog`, inside `BEGIN READ ONLY` / `ROLLBACK`. Statement/lock/idle transaction limits are 5s/1s/10s, with a catalog-only search path. It never selects application relations or invokes application functions.
- `scripts/operations/rls-metadata-audit.py`: explicit target connection, 30s process deadline, no psql startup file or interactive credential fallback. Credentials use a temporary 0600 pgpass file in a private directory; URL/password are absent from argv and child env. Raw libpq/SQL stderr is discarded; failures expose fixed codes. Unknown connection options fail before connecting.
- `scripts/operations/test_rls_metadata_audit.py`: seven no-DB safety tests. The SQL source guard allows only the named CTEs/catalogs and a reviewed native-function list, and excludes DDL/DML/dynamic psql commands, credential catalog/config fields, expression deparsing and function bodies.
- `.github/workflows/rls-metadata-audit.yml`: a manual-only collector, `contents: read`, main-ref gate, five-minute job cap, no app build or migrations/import/deployment. It uses only the existing migrator Secret, requires an independently reviewed expected login role, and retains metadata for one day. Before a production dispatch, the reviewer must confirm the exact source revision and metadata retention destination.

Exit 0 means the expected login was observed and inventory fit its bounds. It does not mean the permissions are safe, RLS semantics are equivalent, or a deployed Worker uses the named app role. Exit 2 preserves metadata while flagging an unexpected identity or incomplete bounds. Other failures output fixed error codes and no raw connection diagnostics.

## Facts the inventory can establish

The report records actual session/current role, role flags, recursive ancestor memberships and MEMBER/USAGE/SET capabilities. It includes schema and effective table/sequence/column privileges, relation ownership and RLS enabled/forced flags, the current session's `row_security_active` result, policy name/command/role/permissiveness inventory, security-definer function identity/execute ACL metadata and default ACLs. Column names and privilege booleans are schema metadata; column values are never read.

Policy expressions are represented only by hashes of their stored catalog trees. The script does not deparse or execute them. Stored trees contain object OIDs and are not portable semantic fingerprints across databases/restores or PostgreSQL versions. Matching names or hashes cannot replace the existing family behavior tests or a reviewed definition comparison. Function bodies, `rolpassword`, `rolconfig`, connection strings, application rows and raw errors are excluded.

Bounds are explicit: 64 reachable roles, 32 schemas, 256 relations/functions/policies/membership edges, 512 default-ACL rows and 128 listed columns per relation. Counts/truncation are reported; an incomplete inventory fails its collection gate. A report larger than 4 MiB is withheld.

## Review and execution sequence

1. Review these five files, the safety-test results and the owned-runtime/owner metadata comparison through the normal PR/current-head CI process. Keep production collection as a separate deliberate manual operation.
2. Before any production run, root verifies the intended database/login and that the existing migrator URL is a single-host, explicit password URL compatible with this client's supported TLS options (`sslmode`, `channel_binding`, `sslrootcert`). The role name supplied to the workflow must come from reviewed configuration, rather than being guessed from a possibly drifted database. Unsupported Prisma-only or startup options fail closed; do not strip them or alter a Secret without a separate reviewed decision.
3. For a separately authorized single manual run, inspect the actual migrator-session identity, ownership, flags and inventory. Compare privileges against the reviewed source allowlists in `prisma/roles/production-runtime-bootstrap.sql`, `verify-app-runtime.sql` and the role contract fixtures. Never derive the expected privilege contract from the target's current grants. Preserve the reviewed commit, metadata digest and bounded collection status. A migrator that is an owner, superuser or bypass role can inspect the inventory while its own RLS is inactive; this is an observation, not an app enforcement result.
4. Independently attest the credentials actually bound to `HYPERDRIVE`, `HYPERDRIVE_AUTH` and `HYPERDRIVE_MAINTENANCE`. A later approved private connection probe must observe `session_user` and `current_user` using those same bound credentials. The migrator carrier can inspect named-role metadata but cannot establish which role a deployed Worker logs in as. It never simulates this proof with `SET ROLE`, adds a public diagnostic endpoint, or logs a DSN.
5. Review runtime role flags, ancestor SET/INHERIT paths, ownership, per-column auth grants, function execute surfaces and the enabled/forced policy inventory against each access family's contract. Use the existing disposable-database semantic tests to interpret the structures; metadata collection does not invoke application functions or query private rows for a production canary.
6. Prepare a separate concrete importer transition after those observations. Check whether the existing `life_ustc_importer` is present, can log in and has the restricted importer grants. Any production login/credential provisioning, permission adjustment or new Secret requires the user's/root's explicit production decision. Do not create a placeholder credential or fall back to migrator when a new importer Secret is missing.
7. The eventual Static Sync patch changes only the **Load static snapshot** step's `DATABASE_URL` to `secrets.IMPORTER_DATABASE_URL`, with a missing-credential failure. The **Deploy Prisma migrations** step keeps the separate migrator identity. Re-run actual importer/mirror/permission contracts against an owned clone before a separately approved production cutover. Confirm the real importer session identity and the import outcome in that approved window; then remove the temporary audit carrier when its evidence is retained.

Completion of #601 requires the actual production binding/permission observations and the independent importer rollout. Successful local collection or a successful migrator metadata run alone leaves those requirements open.

## Local verification

Run the no-database safety tests with `python3 scripts/operations/test_rls_metadata_audit.py` and compile both Python files before changing the collector. Parse the workflow to confirm its manual-only trigger, read-only repository permissions and main-ref gate.

For an owned PostgreSQL 16+ environment, set `RLS_AUDIT_DATABASE_URL` and `RLS_AUDIT_EXPECTED_ROLE` in a scoped shell and run `python3 scripts/operations/rls-metadata-audit.py`, redirecting its metadata JSON to a local file. Use separate restricted-runtime and owner credentials. Confirm `transaction_read_only=on`, the expected identity and `complete_within_limits=true` in both results.

Compare a known RLS relation's enabled/forced flags and current-session applicability under both owned identities. A privileged owner's inactive RLS result and a restricted runtime's active result must remain distinct. Keep exact local/independent run results with the delivery evidence; they do not establish production effective permissions.

## Primary references

- [PostgreSQL 16 transaction access modes](https://www.postgresql.org/docs/16/sql-set-transaction.html): read-only is a SQL transaction boundary and does not prevent all server disk activity. The catalog/source/function allowlist is part of this carrier's separate scope control.
- [PostgreSQL 16 membership options](https://www.postgresql.org/docs/16/catalog-pg-auth-members.html) and [privilege inquiries](https://www.postgresql.org/docs/16/functions-info.html): direct membership, effective inherited privileges and ability to SET ROLE are distinct.
- [Connection defaults and row security](https://www.postgresql.org/docs/16/runtime-config-client.html): `row_security=off` causes errors for policy-restricted reads and does not change the privileges of a bypass role.
- [libpq connection environment](https://www.postgresql.org/docs/16/libpq-envars.html) and [protected password files](https://www.postgresql.org/docs/16/libpq-pgpass.html): explicit target fields and a private credential file keep connection material out of command arguments and logs.
