#!/usr/bin/env bash
set -euo pipefail

# This intentionally uses a fixed local-only database name. It must never be
# pointed at production; the script drops the database before and after use.
readonly upgrade_database_name="life_ustc_audit_upgrade_test"
readonly admin_database_url="postgresql://postgres:postgres@127.0.0.1:5432/postgres"
readonly upgrade_database_url="postgresql://postgres:postgres@127.0.0.1:5432/${upgrade_database_name}"
readonly baseline_commit="${AUDIT_UPGRADE_BASE_COMMIT:-origin/main}"
baseline_directory="$(mktemp -d /tmp/life-ustc-audit-upgrade.XXXXXX)"

cleanup() {
  psql "$admin_database_url" -X --set=ON_ERROR_STOP=on \
    --command="DROP DATABASE IF EXISTS ${upgrade_database_name} WITH (FORCE)" \
    >/dev/null 2>&1 || true
  case "$baseline_directory" in
    /tmp/life-ustc-audit-upgrade.*)
      rm -rf -- "$baseline_directory"
      ;;
  esac
}
trap cleanup EXIT

cleanup
baseline_directory="$(mktemp -d /tmp/life-ustc-audit-upgrade.XXXXXX)"
if ! git cat-file -e "${baseline_commit}^{commit}"; then
  echo "audit upgrade baseline commit is unavailable: ${baseline_commit}" >&2
  exit 1
fi
git archive "$baseline_commit" prisma/migrations | tar -x -C "$baseline_directory"

psql "$admin_database_url" -X --set=ON_ERROR_STOP=on \
  --command="CREATE DATABASE ${upgrade_database_name}" >/dev/null

# Production already has these cluster roles when the new migrations run. The
# normal fresh-database CI path creates them only after migrate deploy, so this
# setup exercises the otherwise-missed conditional owner/grant path.
psql "$admin_database_url" -X --set=ON_ERROR_STOP=on <<'SQL'
DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_runtime') THEN
    CREATE ROLE life_ustc_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_auth_runtime') THEN
    CREATE ROLE life_ustc_auth_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_maintenance_runtime') THEN
    CREATE ROLE life_ustc_maintenance_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_function_owner') THEN
    CREATE ROLE life_ustc_function_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT NOBYPASSRLS;
  END IF;
END
$roles$;
SQL

# Build the exact legacy schema from the PR base/main commit, not from the
# working tree. This catches migrations that pass on a fresh current schema but
# fail when production roles and historical rows already exist.
while IFS= read -r migration_file; do
  psql "$upgrade_database_url" -X --set=ON_ERROR_STOP=on --file="$migration_file" >/dev/null
done < <(
  find "$baseline_directory/prisma/migrations" \
    -mindepth 2 -maxdepth 2 -name migration.sql | sort
)

# Match the relevant pre-release production grants. Later migration DO blocks
# must update these existing roles without relying on a post-migration bootstrap.
psql "$upgrade_database_url" -X --set=ON_ERROR_STOP=on <<'SQL'
GRANT CONNECT ON DATABASE life_ustc_audit_upgrade_test TO
  life_ustc_runtime,
  life_ustc_auth_runtime,
  life_ustc_maintenance_runtime;
GRANT USAGE ON SCHEMA public TO
  life_ustc_runtime,
  life_ustc_auth_runtime,
  life_ustc_maintenance_runtime,
  life_ustc_function_owner;
GRANT SELECT ON TABLE public."Session" TO life_ustc_function_owner;

SET session_replication_role = replica;
INSERT INTO public."HomeworkAuditLog" (
  "id", "action", "titleSnapshot", "createdAt", "sectionId", "homeworkId", "actorId"
) VALUES (
  'legacy-audit-1', 'deleted', 'Legacy title retained',
  '2026-08-01T00:00:00Z', 424242, NULL, NULL
);
SET session_replication_role = origin;
SQL

psql "$upgrade_database_url" -X --set=ON_ERROR_STOP=on \
  --file=scripts/production/audit-release-preflight.sql >/dev/null

for migration_name in \
  20260815120000_expand_account_security_audit \
  20260815130000_add_admin_and_homework_audit_actions \
  20260815140000_unify_audit_and_add_retention \
  20260815143000_add_oauth_grant_usage_daily \
  20260816120000_harden_audit_storage_and_account_deletion; do
  psql "$upgrade_database_url" -X --set=ON_ERROR_STOP=on \
    --file="prisma/migrations/${migration_name}/migration.sql" >/dev/null
done

psql "$upgrade_database_url" -X --set=ON_ERROR_STOP=on \
  --file=scripts/production/audit-release-verify.sql >/dev/null

psql "$upgrade_database_url" -X --set=ON_ERROR_STOP=on <<'SQL'
DO $verify$
DECLARE
  migrated_title text;
BEGIN
  IF pg_catalog.to_regclass('public."HomeworkAuditLog"') IS NOT NULL THEN
    RAISE EXCEPTION 'legacy HomeworkAuditLog still exists';
  END IF;

  SELECT audit."metadata"->>'titleSnapshot'
  INTO migrated_title
  FROM public."AuditLog" AS audit
  WHERE audit."id" = 'homework_legacy-audit-1';
  IF migrated_title IS DISTINCT FROM 'Legacy title retained' THEN
    RAISE EXCEPTION 'legacy title snapshot was not preserved: %', migrated_title;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname IN (
        'AuditLog_targetType_targetId_createdAt_idx',
        'AuditLog_channel_createdAt_idx',
        'AuditLog_outcome_createdAt_idx',
        'OAuthGrantUsageDaily_day_id_idx'
      )
    GROUP BY schemaname
    HAVING count(*) = 4
  ) THEN
    RAISE EXCEPTION 'one or more release indexes are missing';
  END IF;

  IF NOT (
    SELECT relrowsecurity
    FROM pg_class
    WHERE oid = 'public."AuditLog"'::regclass
  ) THEN
    RAISE EXCEPTION 'AuditLog RLS is not enabled';
  END IF;
END
$verify$;

INSERT INTO public."User" (
  "id", "email", "emailVerified", "name", "profilePictures", "isAdmin",
  "createdAt", "updatedAt"
) VALUES
  ('upgrade-user-a', 'upgrade-a@example.test', true, 'Upgrade A', '{}', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('upgrade-user-b', 'upgrade-b@example.test', true, 'Upgrade B', '{}', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO public."Session" (
  "id", "sessionToken", "userId", "expires", "createdAt", "updatedAt"
) VALUES (
  'upgrade-session-a', 'upgrade-token-a', 'upgrade-user-a',
  CURRENT_TIMESTAMP + interval '1 hour', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

CREATE TEMP TABLE release_results (status text NOT NULL);
GRANT INSERT ON TABLE pg_temp.release_results TO life_ustc_auth_runtime;
SET ROLE life_ustc_auth_runtime;
INSERT INTO pg_temp.release_results(status)
  SELECT public.delete_own_account(
    'upgrade-user-b', 'upgrade-denied-audit', 'system', NULL, NULL,
    'upgrade-session-a', 'upgrade-request-denied'
  );
RESET ROLE;
DO $verify_cross_user$
BEGIN
  IF (SELECT status FROM pg_temp.release_results LIMIT 1) IS DISTINCT FROM 'unauthorized' THEN
    RAISE EXCEPTION 'cross-user deletion was not denied';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public."User" WHERE "id" = 'upgrade-user-b') THEN
    RAISE EXCEPTION 'cross-user deletion removed the target';
  END IF;
END
$verify_cross_user$;

TRUNCATE pg_temp.release_results;
SET ROLE life_ustc_auth_runtime;
INSERT INTO pg_temp.release_results(status)
  SELECT public.delete_own_account(
    'upgrade-user-a', 'upgrade-success-audit', 'system', NULL, NULL,
    'upgrade-session-a', 'upgrade-request-success'
  );
RESET ROLE;
DO $verify_self$
BEGIN
  IF (SELECT status FROM pg_temp.release_results LIMIT 1) IS DISTINCT FROM 'deleted' THEN
    RAISE EXCEPTION 'same-session account deletion failed';
  END IF;
END
$verify_self$;
SQL

echo "audit production upgrade test passed"
