BEGIN;

ALTER TABLE "Upload" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Upload" FORCE ROW LEVEL SECURITY;

CREATE POLICY "Upload_owner_isolation" ON "Upload"
  FOR ALL
  USING ("userId" = current_setting('app.user_id', true))
  WITH CHECK ("userId" = current_setting('app.user_id', true));

ALTER TABLE "UploadPending" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UploadPending" FORCE ROW LEVEL SECURITY;

CREATE POLICY "UploadPending_owner_isolation" ON "UploadPending"
  FOR ALL
  USING ("userId" = current_setting('app.user_id', true))
  WITH CHECK ("userId" = current_setting('app.user_id', true));

-- Upload bytes attached to a visible comment remain downloadable by signed-in
-- viewers. The caller identity comes only from the transaction-local RLS
-- context, so callers cannot substitute another viewer ID.
CREATE FUNCTION public.find_downloadable_upload(
  p_upload_id text
)
RETURNS TABLE (
  "contentType" text,
  filename text,
  key text,
  "userId" text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  WITH viewer AS (
    SELECT NULLIF(current_setting('app.user_id', true), '') AS id
  )
  SELECT
    upload."contentType",
    upload."filename",
    upload."key",
    upload."userId"
  FROM public."Upload" AS upload
  CROSS JOIN viewer
  WHERE upload."id" = p_upload_id
    AND viewer.id IS NOT NULL
    AND (
      upload."userId" = viewer.id
      OR EXISTS (
        SELECT 1
        FROM public."CommentAttachment" AS attachment
        JOIN public."Comment" AS comment
          ON comment."id" = attachment."commentId"
        WHERE attachment."uploadId" = upload."id"
          AND (
            (
              comment."status" = 'active'
              AND comment."visibility" IN ('public', 'logged_in_only')
            )
            OR (
              comment."status" = 'softbanned'
              AND (
                comment."userId" = viewer.id
                OR EXISTS (
                  SELECT 1
                  FROM public."User" AS app_user
                  WHERE app_user."id" = viewer.id
                    AND app_user."isAdmin" IS TRUE
                )
              )
            )
          )
      )
    );
$function$;

REVOKE EXECUTE
  ON FUNCTION public.find_downloadable_upload(text)
  FROM PUBLIC;

-- Comment queries fetch attachment IDs without joining the owner-protected
-- Upload table. This function restores only the attachment projection that the
-- current viewer is allowed to see.
CREATE FUNCTION public.comment_attachment_summaries(
  p_comment_ids text[]
)
RETURNS TABLE (
  id text,
  "commentId" text,
  "uploadId" text,
  filename text,
  "contentType" text,
  size integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  WITH viewer_id AS (
    SELECT NULLIF(current_setting('app.user_id', true), '') AS id
  ),
  viewer AS (
    SELECT
      viewer_id.id,
      COALESCE((
        SELECT app_user."isAdmin"
        FROM public."User" AS app_user
        WHERE app_user."id" = viewer_id.id
      ), FALSE) AS "isAdmin"
    FROM viewer_id
  )
  SELECT
    attachment."id",
    attachment."commentId",
    attachment."uploadId",
    upload."filename",
    upload."contentType",
    upload."size"
  FROM public."CommentAttachment" AS attachment
  JOIN public."Comment" AS comment
    ON comment."id" = attachment."commentId"
  JOIN public."Upload" AS upload
    ON upload."id" = attachment."uploadId"
  CROSS JOIN viewer
  WHERE attachment."commentId" = ANY(p_comment_ids)
    AND (
      (
        comment."status" = 'active'
        AND (
          comment."visibility" = 'public'
          OR viewer.id IS NOT NULL
        )
      )
      OR (
        comment."status" = 'softbanned'
        AND viewer.id IS NOT NULL
        AND (comment."userId" = viewer.id OR viewer."isAdmin")
      )
    )
  ORDER BY attachment."createdAt", attachment."id";
$function$;

REVOKE EXECUTE
  ON FUNCTION public.comment_attachment_summaries(text[])
  FROM PUBLIC;

-- Public profiles already expose the total upload count and contribution
-- heatmap. Keep that exact projection without granting direct cross-owner
-- access to Upload rows.
CREATE FUNCTION public.get_public_profile_upload_stats(
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
  WITH total AS (
    SELECT count(*) AS count
    FROM public."Upload"
    WHERE "userId" = p_user_id
  ),
  recent AS (
    SELECT "createdAt"
    FROM public."Upload"
    WHERE "userId" = p_user_id
      AND "createdAt" >= p_since
  )
  SELECT total.count, recent."createdAt"
  FROM total
  LEFT JOIN recent ON TRUE
  ORDER BY recent."createdAt";
$function$;

REVOKE EXECUTE
  ON FUNCTION public.get_public_profile_upload_stats(
    text,
    timestamp without time zone
  )
  FROM PUBLIC;

COMMIT;
