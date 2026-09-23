-- Rename personal catalog-link tables and RLS policies to match workspace naming.

ALTER TABLE "DashboardLinkClick" RENAME TO "CatalogLinkClick";
ALTER TABLE "DashboardLinkPin" RENAME TO "WorkspaceLinkPin";

ALTER INDEX "DashboardLinkClick_userId_slug_key" RENAME TO "CatalogLinkClick_userId_slug_key";
ALTER INDEX "DashboardLinkClick_userId_idx" RENAME TO "CatalogLinkClick_userId_idx";
ALTER INDEX "DashboardLinkClick_slug_idx" RENAME TO "CatalogLinkClick_slug_idx";
ALTER INDEX "DashboardLinkPin_userId_slug_key" RENAME TO "WorkspaceLinkPin_userId_slug_key";
ALTER INDEX "DashboardLinkPin_userId_idx" RENAME TO "WorkspaceLinkPin_userId_idx";
ALTER INDEX "DashboardLinkPin_slug_idx" RENAME TO "WorkspaceLinkPin_slug_idx";

ALTER POLICY "DashboardLinkClick_owner_isolation" ON "CatalogLinkClick" RENAME TO "CatalogLinkClick_owner_isolation";
ALTER POLICY "DashboardLinkPin_owner_isolation" ON "WorkspaceLinkPin" RENAME TO "WorkspaceLinkPin_owner_isolation";
