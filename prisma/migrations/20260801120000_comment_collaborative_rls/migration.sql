BEGIN;

ALTER TABLE "Comment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Comment" FORCE ROW LEVEL SECURITY;

CREATE POLICY "Comment_public_reader" ON "Comment"
  FOR SELECT
  USING (
    "status" = 'active'
    AND "visibility" = 'public'
  );

CREATE POLICY "Comment_authenticated_reader" ON "Comment"
  FOR SELECT
  USING (
    NULLIF(current_setting('app.user_id', true), '') IS NOT NULL
    AND (
      "status" = 'active'
      OR (
        "status" = 'softbanned'
        AND "userId" = NULLIF(current_setting('app.user_id', true), '')
      )
    )
  );

CREATE POLICY "Comment_admin_reader" ON "Comment"
  FOR SELECT
  USING (
    NULLIF(current_setting('app.user_id', true), '') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public."User" AS app_user
      WHERE app_user."id" = NULLIF(current_setting('app.user_id', true), '')
        AND app_user."isAdmin" IS TRUE
    )
    AND "status" IN ('active', 'softbanned', 'deleted')
  );

CREATE POLICY "Comment_owner_isolation" ON "Comment"
  FOR ALL
  USING ("userId" = NULLIF(current_setting('app.user_id', true), ''))
  WITH CHECK ("userId" = NULLIF(current_setting('app.user_id', true), ''));

CREATE POLICY "Comment_admin_moderator" ON "Comment"
  FOR UPDATE
  USING (
    NULLIF(current_setting('app.user_id', true), '') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public."User" AS app_user
      WHERE app_user."id" = NULLIF(current_setting('app.user_id', true), '')
        AND app_user."isAdmin" IS TRUE
    )
  )
  WITH CHECK (
    NULLIF(current_setting('app.user_id', true), '') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public."User" AS app_user
      WHERE app_user."id" = NULLIF(current_setting('app.user_id', true), '')
        AND app_user."isAdmin" IS TRUE
    )
  );

COMMIT;
