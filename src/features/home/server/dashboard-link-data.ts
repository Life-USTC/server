import { DASHBOARD_LINK_GROUPS } from "@/features/dashboard-links/lib/dashboard-links";
import {
  buildDashboardLinkSummaries,
  dashboardLinksForSlugs,
  recommendedDashboardLinkSummaries,
} from "./dashboard-link-selection";
import type {
  DashboardLinkSummary,
  DashboardLinksData,
} from "./dashboard-link-summary";

const MAX_OVERVIEW_LINKS = 4;

export type { DashboardLinkSummary, DashboardLinksData };

export function getPublicDashboardLinksData(): {
  dashboardLinks: DashboardLinkSummary[];
  overviewLinks: DashboardLinkSummary[];
} {
  const emptyClickStats: Record<string, number> = {};
  const emptyPinnedSet = new Set<string>();
  const { dashboardLinks, dashboardLinkBySlug } = buildDashboardLinkSummaries(
    emptyClickStats,
    emptyPinnedSet,
  );
  const overviewLinks = dashboardLinksForSlugs(
    DASHBOARD_LINK_GROUPS.mostClicked.slice(0, MAX_OVERVIEW_LINKS),
    dashboardLinkBySlug,
  );

  return {
    dashboardLinks,
    overviewLinks,
  };
}

export async function getSignedInDashboardLinksData(
  userId: string,
): Promise<DashboardLinksData> {
  const { prisma } = await import("@/lib/db/prisma");
  const [clickRows, pinRows] = await Promise.all([
    prisma.dashboardLinkClick.findMany({
      where: { userId },
      select: { slug: true, count: true },
    }),
    prisma.dashboardLinkPin.findMany({
      where: { userId },
      select: { slug: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const clickStats: Record<string, number> = Object.fromEntries(
    clickRows.map((row) => [row.slug, row.count]),
  );
  const pinnedSlugSet = new Set(pinRows.map((row) => row.slug));

  const { dashboardLinks, dashboardLinkBySlug } = buildDashboardLinkSummaries(
    clickStats,
    pinnedSlugSet,
  );
  const pinnedLinks = dashboardLinksForSlugs(
    pinRows.map((row) => row.slug),
    dashboardLinkBySlug,
  );
  const recommendedLinks = recommendedDashboardLinkSummaries(
    clickStats,
    pinnedSlugSet,
  );
  const overviewLinks = [...pinnedLinks, ...recommendedLinks].slice(
    0,
    MAX_OVERVIEW_LINKS,
  );

  return {
    dashboardLinks,
    recommendedLinks,
    pinnedLinks,
    overviewLinks,
  };
}

export async function getLinksTabData(userId: string) {
  return getSignedInDashboardLinksData(userId);
}
