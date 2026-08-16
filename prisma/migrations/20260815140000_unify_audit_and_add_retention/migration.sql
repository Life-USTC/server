-- AuditLog is the single append-only trail. Preserve historical homework events
-- before removing the narrower legacy table.
INSERT INTO "AuditLog" (
  "id",
  "action",
  "outcome",
  "channel",
  "userId",
  "subjectUserId",
  "targetId",
  "targetType",
  "metadata",
  "createdAt"
)
SELECT
  'homework_' || legacy."id",
  CASE legacy."action"::text
    WHEN 'created' THEN 'homework_create'::"AuditAction"
    ELSE 'homework_delete'::"AuditAction"
  END,
  'success'::"AuditOutcome",
  'web'::"AuditChannel",
  legacy."actorId",
  legacy."actorId",
  legacy."homeworkId",
  'homework',
  jsonb_build_object(
    'sectionId', legacy."sectionId",
    'titleSnapshot', legacy."titleSnapshot"
  ),
  legacy."createdAt"
FROM "HomeworkAuditLog" AS legacy;

DROP TABLE "HomeworkAuditLog";
DROP TYPE "HomeworkAuditAction";

-- Homework completion is private workspace state and no longer contributes to
-- public profile activity.
DROP FUNCTION public.get_public_profile_homework_completions(
  text,
  timestamp without time zone
);
DROP POLICY "HomeworkCompletion_profile_reader" ON "HomeworkCompletion";

CREATE INDEX "AuditLog_targetType_targetId_createdAt_idx"
  ON "AuditLog"("targetType", "targetId", "createdAt" DESC);
CREATE INDEX "AuditLog_channel_createdAt_idx"
  ON "AuditLog"("channel", "createdAt" DESC);
CREATE INDEX "AuditLog_outcome_createdAt_idx"
  ON "AuditLog"("outcome", "createdAt" DESC);

-- Security data has shorter attribution windows than the event itself:
-- network details: 30 days; request/session/grant correlation: 90 days;
-- entire audit rows: 400 days. Work is bounded and safe to call repeatedly.
CREATE FUNCTION public.maintain_audit_log_retention(
  p_now timestamp(3) without time zone,
  p_batch_size integer
)
RETURNS TABLE (
  network_anonymized bigint,
  attribution_anonymized bigint,
  rows_deleted bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_network_anonymized bigint;
  v_attribution_anonymized bigint;
  v_rows_deleted bigint;
BEGIN
  IF p_now IS NULL THEN
    RAISE EXCEPTION 'now must not be null' USING ERRCODE = '22004';
  END IF;
  IF p_now > (pg_catalog.statement_timestamp() AT TIME ZONE 'UTC') THEN
    RAISE EXCEPTION 'now must not be in the future' USING ERRCODE = '22023';
  END IF;
  IF p_batch_size IS NULL OR p_batch_size < 1 OR p_batch_size > 1000 THEN
    RAISE EXCEPTION 'batch size must be between 1 and 1000' USING ERRCODE = '22023';
  END IF;

  WITH candidates AS (
    SELECT source."id"
    FROM public."AuditLog" AS source
    WHERE source."createdAt" < p_now - interval '30 days'
      AND (source."ipAddress" IS NOT NULL OR source."userAgent" IS NOT NULL)
    ORDER BY source."createdAt", source."id"
    LIMIT p_batch_size
    FOR UPDATE OF source SKIP LOCKED
  )
  UPDATE public."AuditLog" AS target
  SET "ipAddress" = NULL, "userAgent" = NULL
  FROM candidates
  WHERE target."id" = candidates."id";
  GET DIAGNOSTICS v_network_anonymized = ROW_COUNT;

  WITH candidates AS (
    SELECT source."id"
    FROM public."AuditLog" AS source
    WHERE source."createdAt" < p_now - interval '90 days'
      AND (
        source."oauthGrantId" IS NOT NULL
        OR source."sessionId" IS NOT NULL
        OR source."requestId" IS NOT NULL
      )
    ORDER BY source."createdAt", source."id"
    LIMIT p_batch_size
    FOR UPDATE OF source SKIP LOCKED
  )
  UPDATE public."AuditLog" AS target
  SET "oauthGrantId" = NULL, "sessionId" = NULL, "requestId" = NULL
  FROM candidates
  WHERE target."id" = candidates."id";
  GET DIAGNOSTICS v_attribution_anonymized = ROW_COUNT;

  WITH candidates AS (
    SELECT source."id"
    FROM public."AuditLog" AS source
    WHERE source."createdAt" < p_now - interval '400 days'
    ORDER BY source."createdAt", source."id"
    LIMIT p_batch_size
    FOR UPDATE OF source SKIP LOCKED
  )
  DELETE FROM public."AuditLog" AS target
  USING candidates
  WHERE target."id" = candidates."id";
  GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;

  RETURN QUERY SELECT
    v_network_anonymized,
    v_attribution_anonymized,
    v_rows_deleted;
END;
$function$;

REVOKE EXECUTE
  ON FUNCTION public.maintain_audit_log_retention(timestamp without time zone, integer)
  FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_function_owner') THEN
    -- The public-profile subscription helper is owned by this no-login role
    -- after the production bootstrap and needs its backing-table read grant.
    EXECUTE 'GRANT SELECT ON TABLE public."UserSectionSubscription" TO life_ustc_function_owner';
    EXECUTE 'GRANT SELECT, UPDATE, DELETE ON TABLE public."AuditLog" TO life_ustc_function_owner';
    EXECUTE 'ALTER FUNCTION public.maintain_audit_log_retention(timestamp without time zone, integer) OWNER TO life_ustc_function_owner';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_maintenance_runtime') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.maintain_audit_log_retention(timestamp without time zone, integer) TO life_ustc_maintenance_runtime';
  END IF;
END $$;

-- Generic audit target IDs are intentionally not foreign keys. Clear the
-- account-shaped targets in the same transaction as self-service deletion so
-- retained history cannot keep a deleted user's raw identifier.
CREATE FUNCTION public.anonymize_deleted_account_audit_targets(p_user_id text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_rows bigint;
BEGIN
  IF p_user_id IS NULL OR pg_catalog.btrim(p_user_id) = '' THEN
    RAISE EXCEPTION 'user id must not be empty' USING ERRCODE = '22023';
  END IF;

  UPDATE public."AuditLog"
  SET "targetId" = NULL
  WHERE "targetId" = p_user_id
    AND "targetType" IN ('user', 'calendar_feed');
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$function$;

REVOKE EXECUTE
  ON FUNCTION public.anonymize_deleted_account_audit_targets(text)
  FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_function_owner') THEN
    EXECUTE 'GRANT SELECT, UPDATE ON TABLE public."AuditLog" TO life_ustc_function_owner';
    EXECUTE 'ALTER FUNCTION public.anonymize_deleted_account_audit_targets(text) OWNER TO life_ustc_function_owner';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_auth_runtime') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.anonymize_deleted_account_audit_targets(text) TO life_ustc_auth_runtime';
  END IF;
END $$;
