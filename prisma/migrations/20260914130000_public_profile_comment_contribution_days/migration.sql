BEGIN;

-- Public profiles expose the existing active + softbanned comment contribution
-- range without granting the runtime role cross-owner Comment row access.
CREATE FUNCTION public.get_public_profile_comment_contribution_days(
  p_user_id text,
  p_since timestamp(3) without time zone
)
RETURNS TABLE (
  "date" text,
  "count" bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT
    to_char(
      (comment."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Shanghai',
      'YYYY-MM-DD'
    ) AS "date",
    COUNT(*)::bigint AS "count"
  FROM public."Comment" AS comment
  WHERE comment."userId" = p_user_id
    AND comment."createdAt" >= p_since
    AND comment."status" IN ('active', 'softbanned')
  GROUP BY 1
  ORDER BY 1;
$function$;

REVOKE EXECUTE
  ON FUNCTION public.get_public_profile_comment_contribution_days(
    text,
    timestamp without time zone
  )
  FROM PUBLIC;

DO $grant_public_profile_comment_days$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_function_owner'
  ) THEN
    ALTER FUNCTION public.get_public_profile_comment_contribution_days(
      text,
      timestamp without time zone
    ) OWNER TO life_ustc_function_owner;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_runtime'
  ) THEN
    GRANT EXECUTE ON FUNCTION
      public.get_public_profile_comment_contribution_days(
        text,
        timestamp without time zone
      )
      TO life_ustc_runtime;
  END IF;
END
$grant_public_profile_comment_days$;

COMMIT;
