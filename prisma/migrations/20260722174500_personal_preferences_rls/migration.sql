ALTER TABLE "DashboardLinkClick" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DashboardLinkClick" FORCE ROW LEVEL SECURITY;
CREATE POLICY "DashboardLinkClick_owner_isolation" ON "DashboardLinkClick"
  FOR ALL
  USING ("userId" = current_setting('app.user_id', true))
  WITH CHECK ("userId" = current_setting('app.user_id', true));

ALTER TABLE "DashboardLinkPin" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DashboardLinkPin" FORCE ROW LEVEL SECURITY;
CREATE POLICY "DashboardLinkPin_owner_isolation" ON "DashboardLinkPin"
  FOR ALL
  USING ("userId" = current_setting('app.user_id', true))
  WITH CHECK ("userId" = current_setting('app.user_id', true));

ALTER TABLE "BusUserPreference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BusUserPreference" FORCE ROW LEVEL SECURITY;
CREATE POLICY "BusUserPreference_owner_isolation" ON "BusUserPreference"
  FOR ALL
  USING ("userId" = current_setting('app.user_id', true))
  WITH CHECK ("userId" = current_setting('app.user_id', true));
