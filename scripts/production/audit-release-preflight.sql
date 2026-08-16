\set ON_ERROR_STOP on

-- Read-only preflight for the account/audit maintenance-window release. Run
-- with MIGRATOR_DATABASE_URL before applying the five 20260815/16 migrations.
DO $preflight$
BEGIN
  IF pg_catalog.to_regclass('public."HomeworkAuditLog"') IS NULL THEN
    RAISE EXCEPTION 'expected legacy HomeworkAuditLog; database is not at the pre-release state';
  END IF;
  IF pg_catalog.to_regprocedure(
    'public.get_public_profile_homework_completions(text,timestamp without time zone)'
  ) IS NULL THEN
    RAISE EXCEPTION 'expected legacy public profile function is missing';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public."HomeworkAuditLog" AS legacy
    JOIN public."AuditLog" AS audit
      ON audit."id" = 'homework_' || legacy."id"
  ) THEN
    RAISE EXCEPTION 'AuditLog ID collision would make the legacy backfill fail';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM (VALUES
      ('life_ustc_runtime'),
      ('life_ustc_auth_runtime'),
      ('life_ustc_maintenance_runtime'),
      ('life_ustc_function_owner')
    ) AS required(role_name)
    WHERE NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = required.role_name
    )
  ) THEN
    RAISE EXCEPTION 'one or more production runtime roles are missing';
  END IF;
  IF NOT (
    SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname = current_user
  ) AND NOT pg_catalog.pg_has_role(
    current_user,
    'life_ustc_function_owner',
    'MEMBER'
  ) THEN
    RAISE EXCEPTION 'migrator cannot transfer/drop functions owned by life_ustc_function_owner';
  END IF;
END
$preflight$;

SELECT
  pg_catalog.current_database() AS database_name,
  current_user AS migrator,
  pg_catalog.pg_size_pretty(
    pg_catalog.pg_total_relation_size('public."AuditLog"'::regclass)
  ) AS audit_log_size,
  (SELECT pg_catalog.count(*) FROM public."AuditLog") AS audit_rows,
  (SELECT pg_catalog.count(*) FROM public."HomeworkAuditLog") AS legacy_homework_audit_rows;

-- Any row here should be investigated before taking the maintenance window.
SELECT
  pid,
  usename,
  application_name,
  state,
  pg_catalog.clock_timestamp() - xact_start AS transaction_age,
  wait_event_type,
  wait_event
FROM pg_catalog.pg_stat_activity
WHERE datname = pg_catalog.current_database()
  AND pid <> pg_catalog.pg_backend_pid()
  AND xact_start < pg_catalog.clock_timestamp() - interval '30 seconds'
ORDER BY xact_start;
