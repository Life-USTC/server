BEGIN;

-- Public contribution projections must not reveal private activity or connect
-- anonymous content to the profile owner's identity. Replacing the functions
-- preserves their existing runtime grants and restricted function owner.
CREATE OR REPLACE FUNCTION public.get_public_profile_comment_contribution_days(
  p_user_id text,
  p_since timestamp(3) without time zone
)
RETURNS TABLE ("date" text, "count" bigint)
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
    AND comment."status" = 'active'
    AND comment."visibility" = 'public'
    AND comment."isAnonymous" = false
    AND comment."deletedAt" IS NULL
  GROUP BY 1
  ORDER BY 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_public_profile_upload_stats(
  p_user_id text,
  p_since timestamp(3) without time zone
)
RETURNS TABLE (
  "totalUploads" bigint,
  "createdAt" timestamp(3) without time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  WITH public_uploads AS (
    SELECT upload."createdAt"
    FROM public."Upload" AS upload
    JOIN public."CommentAttachment" AS attachment
      ON attachment."uploadId" = upload."id"
    JOIN public."Comment" AS comment
      ON comment."id" = attachment."commentId"
    WHERE upload."userId" = p_user_id
      AND comment."userId" = p_user_id
      AND comment."status" = 'active'
      AND comment."visibility" = 'public'
      AND comment."isAnonymous" = false
      AND comment."deletedAt" IS NULL
  ), total AS (
    SELECT COUNT(*) AS count FROM public_uploads
  ), recent AS (
    SELECT "createdAt" FROM public_uploads WHERE "createdAt" >= p_since
  )
  SELECT total.count, recent."createdAt"
  FROM total
  LEFT JOIN recent ON TRUE
  ORDER BY recent."createdAt";
$function$;

-- Personal subscriptions have no public projection.
DROP FUNCTION public.get_public_profile_section_subscription_count(text);

COMMIT;
