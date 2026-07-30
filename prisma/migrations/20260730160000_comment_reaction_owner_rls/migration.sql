BEGIN;

ALTER TABLE "CommentReaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CommentReaction" FORCE ROW LEVEL SECURITY;

CREATE POLICY "CommentReaction_owner_isolation" ON "CommentReaction"
  FOR ALL
  USING ("userId" = current_setting('app.user_id', true))
  WITH CHECK ("userId" = current_setting('app.user_id', true));

-- FORCE RLS also applies to a non-BYPASSRLS table owner. This policy is bound
-- to the migration owner and activated only by the summary function below.
CREATE POLICY "CommentReaction_summary_reader" ON "CommentReaction"
  FOR SELECT
  TO CURRENT_USER
  USING (
    current_setting('app.comment_reaction_summary', true) = 'on'
  );

CREATE FUNCTION public.comment_reaction_summaries(comment_ids text[])
RETURNS TABLE (
  "commentId" text,
  "type" public."CommentReactionType",
  "count" bigint,
  "viewerHasReacted" boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
SET app.comment_reaction_summary = 'on'
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
    reaction."commentId",
    reaction."type",
    count(*) AS "count",
    coalesce(
      bool_or(
        viewer.id IS NOT NULL AND reaction."userId" = viewer.id
      ),
      false
    ) AS "viewerHasReacted"
  FROM public."CommentReaction" AS reaction
  JOIN public."Comment" AS comment
    ON comment."id" = reaction."commentId"
  CROSS JOIN viewer
  WHERE reaction."commentId" = ANY(comment_ids)
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
  GROUP BY reaction."commentId", reaction."type"
$function$;

REVOKE ALL
  ON FUNCTION public.comment_reaction_summaries(text[])
  FROM PUBLIC;

COMMIT;
