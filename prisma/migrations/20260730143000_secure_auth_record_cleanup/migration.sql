BEGIN;

CREATE FUNCTION public.cleanup_expired_auth_records(
  p_cutoff timestamp(3) without time zone,
  p_batch_size integer
)
RETURNS TABLE (
  sessions bigint,
  verification_tokens bigint,
  oauth_access_tokens bigint,
  oauth_refresh_tokens bigint,
  device_codes bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_sessions bigint;
  v_verification_tokens bigint;
  v_oauth_access_tokens bigint;
  v_oauth_refresh_tokens bigint;
  v_device_codes bigint;
BEGIN
  IF p_cutoff IS NULL THEN
    RAISE EXCEPTION 'cutoff must not be null'
      USING ERRCODE = '22004';
  END IF;

  IF p_cutoff > (pg_catalog.statement_timestamp() AT TIME ZONE 'UTC') THEN
    RAISE EXCEPTION 'cutoff must not be in the future'
      USING ERRCODE = '22023';
  END IF;

  IF p_batch_size IS NULL OR p_batch_size < 1 OR p_batch_size > 1000 THEN
    RAISE EXCEPTION 'batch size must be between 1 and 1000'
      USING ERRCODE = '22023';
  END IF;

  WITH expired AS (
    SELECT source."id"
    FROM public."OAuthAccessToken" AS source
    WHERE source."expiresAt" < p_cutoff
    ORDER BY source."expiresAt", source."id"
    LIMIT p_batch_size
    FOR UPDATE OF source SKIP LOCKED
  )
  DELETE FROM public."OAuthAccessToken" AS target
  USING expired
  WHERE target."id" = expired."id";
  GET DIAGNOSTICS v_oauth_access_tokens = ROW_COUNT;

  WITH expired AS (
    SELECT source."id"
    FROM public."OAuthRefreshToken" AS source
    WHERE source."expiresAt" < p_cutoff
    ORDER BY source."expiresAt", source."id"
    LIMIT p_batch_size
    FOR UPDATE OF source SKIP LOCKED
  )
  DELETE FROM public."OAuthRefreshToken" AS target
  USING expired
  WHERE target."id" = expired."id";
  GET DIAGNOSTICS v_oauth_refresh_tokens = ROW_COUNT;

  WITH expired AS (
    SELECT source."id"
    FROM public."DeviceCode" AS source
    WHERE source."expiresAt" < p_cutoff
    ORDER BY source."expiresAt", source."id"
    LIMIT p_batch_size
    FOR UPDATE OF source SKIP LOCKED
  )
  DELETE FROM public."DeviceCode" AS target
  USING expired
  WHERE target."id" = expired."id";
  GET DIAGNOSTICS v_device_codes = ROW_COUNT;

  WITH expired AS (
    SELECT source."id"
    FROM public."VerificationToken" AS source
    WHERE source."expires" < p_cutoff
    ORDER BY source."expires", source."id"
    LIMIT p_batch_size
    FOR UPDATE OF source SKIP LOCKED
  )
  DELETE FROM public."VerificationToken" AS target
  USING expired
  WHERE target."id" = expired."id";
  GET DIAGNOSTICS v_verification_tokens = ROW_COUNT;

  WITH expired AS (
    SELECT source."id"
    FROM public."Session" AS source
    WHERE source."expires" < p_cutoff
    ORDER BY source."expires", source."id"
    LIMIT p_batch_size
    FOR UPDATE OF source SKIP LOCKED
  )
  DELETE FROM public."Session" AS target
  USING expired
  WHERE target."id" = expired."id";
  GET DIAGNOSTICS v_sessions = ROW_COUNT;

  RETURN QUERY
  SELECT
    v_sessions,
    v_verification_tokens,
    v_oauth_access_tokens,
    v_oauth_refresh_tokens,
    v_device_codes;
END;
$function$;

REVOKE EXECUTE
  ON FUNCTION public.cleanup_expired_auth_records(timestamp without time zone, integer)
  FROM PUBLIC;

COMMIT;
