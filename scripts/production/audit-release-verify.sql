\set ON_ERROR_STOP on

DO $verify$
DECLARE
  required_index text;
BEGIN
  IF pg_catalog.to_regclass('public."HomeworkAuditLog"') IS NOT NULL THEN
    RAISE EXCEPTION 'legacy HomeworkAuditLog was not removed';
  END IF;
  IF pg_catalog.to_regprocedure(
    'public.get_public_profile_homework_completions(text,timestamp without time zone)'
  ) IS NOT NULL THEN
    RAISE EXCEPTION 'legacy public profile function was not removed';
  END IF;
  IF NOT (
    SELECT relrowsecurity
    FROM pg_catalog.pg_class
    WHERE oid = 'public."AuditLog"'::regclass
  ) OR NOT (
    SELECT relrowsecurity
    FROM pg_catalog.pg_class
    WHERE oid = 'public."OAuthGrantUsageDaily"'::regclass
  ) THEN
    RAISE EXCEPTION 'audit storage RLS is not enabled';
  END IF;
  FOREACH required_index IN ARRAY ARRAY[
    'AuditLog_targetType_targetId_createdAt_idx',
    'AuditLog_channel_createdAt_idx',
    'AuditLog_outcome_createdAt_idx',
    'OAuthGrantUsageDaily_day_id_idx'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_class AS relation
      JOIN pg_catalog.pg_index AS index_definition
        ON index_definition.indexrelid = relation.oid
      WHERE relation.relname = required_index
        AND index_definition.indisvalid
        AND index_definition.indisready
    ) THEN
      RAISE EXCEPTION 'required index is missing or invalid: %', required_index;
    END IF;
  END LOOP;
  IF pg_catalog.has_table_privilege(
    'life_ustc_auth_runtime',
    'public."User"',
    'DELETE'
  ) THEN
    RAISE EXCEPTION 'auth runtime still has direct User DELETE';
  END IF;
  IF NOT pg_catalog.has_function_privilege(
    'life_ustc_auth_runtime',
    'public.delete_own_account(text,text,public."AuditChannel",text,text,text,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'auth runtime cannot execute guarded account deletion';
  END IF;
  IF NOT pg_catalog.has_function_privilege(
    'life_ustc_maintenance_runtime',
    'public.maintain_audit_log_retention(timestamp without time zone,integer)',
    'EXECUTE'
  ) OR NOT pg_catalog.has_function_privilege(
    'life_ustc_maintenance_runtime',
    'public.maintain_oauth_grant_usage_retention(timestamp without time zone,integer)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'maintenance runtime retention grants are incomplete';
  END IF;
END
$verify$;

SELECT
  (SELECT pg_catalog.count(*) FROM public."AuditLog" WHERE "id" LIKE 'homework\_%')
    AS migrated_homework_audit_rows,
  (SELECT pg_catalog.count(*) FROM public."AuditLog"
    WHERE "id" LIKE 'homework\_%'
      AND "metadata"->>'titleSnapshot' IS NOT NULL)
    AS migrated_homework_titles,
  pg_catalog.pg_size_pretty(
    pg_catalog.pg_total_relation_size('public."AuditLog"'::regclass)
  ) AS audit_log_size;
