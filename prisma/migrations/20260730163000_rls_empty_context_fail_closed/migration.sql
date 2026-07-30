BEGIN;

ALTER POLICY "Todo_owner_isolation" ON "Todo"
  USING (
    "userId" = NULLIF(current_setting('app.user_id', true), '')
  )
  WITH CHECK (
    "userId" = NULLIF(current_setting('app.user_id', true), '')
  );

ALTER POLICY "DashboardLinkClick_owner_isolation" ON "DashboardLinkClick"
  USING (
    "userId" = NULLIF(current_setting('app.user_id', true), '')
  )
  WITH CHECK (
    "userId" = NULLIF(current_setting('app.user_id', true), '')
  );

ALTER POLICY "DashboardLinkPin_owner_isolation" ON "DashboardLinkPin"
  USING (
    "userId" = NULLIF(current_setting('app.user_id', true), '')
  )
  WITH CHECK (
    "userId" = NULLIF(current_setting('app.user_id', true), '')
  );

ALTER POLICY "BusUserPreference_owner_isolation" ON "BusUserPreference"
  USING (
    "userId" = NULLIF(current_setting('app.user_id', true), '')
  )
  WITH CHECK (
    "userId" = NULLIF(current_setting('app.user_id', true), '')
  );

ALTER POLICY "Upload_owner_isolation" ON "Upload"
  USING (
    "userId" = NULLIF(current_setting('app.user_id', true), '')
  )
  WITH CHECK (
    "userId" = NULLIF(current_setting('app.user_id', true), '')
  );

ALTER POLICY "UploadPending_owner_isolation" ON "UploadPending"
  USING (
    "userId" = NULLIF(current_setting('app.user_id', true), '')
  )
  WITH CHECK (
    "userId" = NULLIF(current_setting('app.user_id', true), '')
  );

ALTER POLICY "HomeworkCompletion_owner_isolation" ON "HomeworkCompletion"
  USING (
    "userId" = NULLIF(current_setting('app.user_id', true), '')
  )
  WITH CHECK (
    "userId" = NULLIF(current_setting('app.user_id', true), '')
  );

ALTER POLICY "CommentReaction_owner_isolation" ON "CommentReaction"
  USING (
    "userId" = NULLIF(current_setting('app.user_id', true), '')
  )
  WITH CHECK (
    "userId" = NULLIF(current_setting('app.user_id', true), '')
  );

COMMIT;
