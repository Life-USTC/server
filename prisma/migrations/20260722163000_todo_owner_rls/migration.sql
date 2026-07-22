ALTER TABLE "Todo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Todo" FORCE ROW LEVEL SECURITY;

CREATE POLICY "Todo_owner_isolation" ON "Todo"
  FOR ALL
  USING ("userId" = current_setting('app.user_id', true))
  WITH CHECK ("userId" = current_setting('app.user_id', true));
