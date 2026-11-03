BEGIN;

ALTER TABLE public."CommentAttachment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CommentAttachment" FORCE ROW LEVEL SECURITY;

-- Reuse Comment's row visibility, including owner/governance reads. Public
-- summaries and download authorization retain their narrower projections.
CREATE POLICY "CommentAttachment_visible_parent" ON public."CommentAttachment"
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public."Comment" AS parent
    WHERE parent.id = "commentId")
);

CREATE POLICY "CommentAttachment_author_insert" ON public."CommentAttachment"
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public."Comment" AS parent
    WHERE parent.id = "commentId" AND parent.status = 'active'
      AND parent."userId" = NULLIF(current_setting('app.user_id', true), ''))
  AND EXISTS (SELECT 1 FROM public."Upload" AS upload
    WHERE upload.id = "uploadId"
      AND upload."userId" = NULLIF(current_setting('app.user_id', true), ''))
  AND EXISTS (SELECT 1 FROM public."User" AS actor
    WHERE actor.id = NULLIF(current_setting('app.user_id', true), '')
      AND NOT EXISTS (SELECT 1 FROM public."UserSuspension" AS suspension
        WHERE suspension."userId" = actor.id AND suspension."liftedAt" IS NULL
          AND (suspension."expiresAt" IS NULL
            OR suspension."expiresAt" > (statement_timestamp() AT TIME ZONE 'UTC'))))
);

CREATE POLICY "CommentAttachment_author_delete" ON public."CommentAttachment"
FOR DELETE USING (
  EXISTS (SELECT 1 FROM public."Comment" AS parent
    WHERE parent.id = "commentId" AND parent.status = 'active'
      AND parent."userId" = NULLIF(current_setting('app.user_id', true), ''))
  AND EXISTS (SELECT 1 FROM public."User" AS actor
    WHERE actor.id = NULLIF(current_setting('app.user_id', true), '')
      AND NOT EXISTS (SELECT 1 FROM public."UserSuspension" AS suspension
        WHERE suspension."userId" = actor.id AND suspension."liftedAt" IS NULL
          AND (suspension."expiresAt" IS NULL
            OR suspension."expiresAt" > (statement_timestamp() AT TIME ZONE 'UTC'))))
);

-- No UPDATE policy: attachment identities and targets are immutable. Existing
-- runtime grants already allow only SELECT, INSERT and DELETE. Foreign-key
-- cascades still remove links when an upload or catalog parent is removed.
COMMIT;
