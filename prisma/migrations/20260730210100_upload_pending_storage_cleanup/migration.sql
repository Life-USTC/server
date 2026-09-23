BEGIN;

CREATE FUNCTION public.claim_upload_pending_storage_cleanup(
  p_now timestamp(3) without time zone,
  p_batch_size integer,
  p_lease_seconds integer
)
RETURNS TABLE (
  id text,
  key text,
  "userId" text,
  "attemptId" text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF p_now IS NULL THEN
    RAISE EXCEPTION 'now must not be null'
      USING ERRCODE = '22004';
  END IF;

  IF p_batch_size IS NULL OR p_batch_size < 1 OR p_batch_size > 1000 THEN
    RAISE EXCEPTION 'batch size must be between 1 and 1000'
      USING ERRCODE = '22023';
  END IF;

  IF p_lease_seconds IS NULL OR p_lease_seconds < 1 OR p_lease_seconds > 3600 THEN
    RAISE EXCEPTION 'lease seconds must be between 1 and 3600'
      USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT source."id"
    FROM public."UploadPending" AS source
    WHERE NOT EXISTS (
      SELECT 1
      FROM public."Upload" AS upload
      WHERE upload."key" = source."key"
    )
      AND (
        (
          source."expiresAt" < p_now
          AND source."phase" IN ('reserved', 'uploaded')
          AND (
            source."leaseExpiresAt" IS NULL
            OR source."leaseExpiresAt" < p_now
          )
        )
        OR (
          source."phase" = 'uploading'
          AND source."leaseExpiresAt" IS NOT NULL
          AND source."leaseExpiresAt" < p_now
        )
        OR (
          source."phase" = 'completing'
          AND source."leaseExpiresAt" IS NOT NULL
          AND source."leaseExpiresAt" < p_now
        )
        OR (
          source."phase" = 'cleaning'
          AND (
            source."leaseExpiresAt" IS NULL
            OR source."leaseExpiresAt" < p_now
          )
        )
      )
    ORDER BY source."expiresAt", source."key"
    LIMIT p_batch_size
    FOR UPDATE OF source SKIP LOCKED
  ),
  claimed AS (
    UPDATE public."UploadPending" AS target
    SET
      "phase" = 'cleaning',
      "leaseExpiresAt" = p_now + make_interval(secs => p_lease_seconds),
      "updatedAt" = p_now
    FROM candidates
    WHERE target."id" = candidates."id"
    RETURNING
      target."id",
      target."key",
      target."userId",
      target."attemptId"
  )
  SELECT
    claimed."id",
    claimed."key",
    claimed."userId",
    claimed."attemptId"
  FROM claimed;
END;
$function$;

CREATE FUNCTION public.finalize_upload_pending_storage_cleanup(
  p_id text,
  p_attempt_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public."UploadPending" AS target
  WHERE target."id" = p_id
    AND target."attemptId" = p_attempt_id
    AND target."phase" = 'cleaning';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted = 1;
END;
$function$;

CREATE FUNCTION public.release_upload_pending_storage_cleanup(
  p_id text,
  p_attempt_id text,
  p_now timestamp(3) without time zone,
  p_retry_lease_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_updated integer;
BEGIN
  IF p_now IS NULL THEN
    RAISE EXCEPTION 'now must not be null'
      USING ERRCODE = '22004';
  END IF;

  IF p_retry_lease_seconds IS NULL
    OR p_retry_lease_seconds < 1
    OR p_retry_lease_seconds > 3600
  THEN
    RAISE EXCEPTION 'retry lease seconds must be between 1 and 3600'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public."UploadPending" AS target
  SET
    "phase" = 'cleaning',
    "leaseExpiresAt" = p_now + make_interval(secs => p_retry_lease_seconds),
    "updatedAt" = p_now
  WHERE target."id" = p_id
    AND target."attemptId" = p_attempt_id
    AND target."phase" = 'cleaning';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$function$;

REVOKE EXECUTE
  ON FUNCTION public.claim_upload_pending_storage_cleanup(
    timestamp without time zone,
    integer,
    integer
  )
  FROM PUBLIC;
REVOKE EXECUTE
  ON FUNCTION public.finalize_upload_pending_storage_cleanup(text, text)
  FROM PUBLIC;
REVOKE EXECUTE
  ON FUNCTION public.release_upload_pending_storage_cleanup(
    text,
    text,
    timestamp without time zone,
    integer
  )
  FROM PUBLIC;

COMMIT;
