-- Retention eligibility includes events exactly at each age threshold.
-- CREATE OR REPLACE preserves the maintenance-only owner and EXECUTE grants.
CREATE OR REPLACE FUNCTION public.maintain_audit_log_retention(
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
    WHERE source."createdAt" <= p_now - interval '30 days'
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
    WHERE source."createdAt" <= p_now - interval '90 days'
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
    WHERE source."createdAt" <= p_now - interval '400 days'
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
