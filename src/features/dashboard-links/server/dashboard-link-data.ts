import { DASHBOARD_LINK_GROUPS } from "@/features/dashboard-links/lib/dashboard-links";
import { type AppLocale, DEFAULT_LOCALE } from "@/i18n/config";
import { prisma, withUserDbContext } from "@/lib/db/prisma";
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

export function getPublicDashboardLinksData(
  locale: AppLocale = DEFAULT_LOCALE,
): {
  dashboardLinks: DashboardLinkSummary[];
  overviewLinks: DashboardLinkSummary[];
} {
  const emptyClickStats: Record<string, number> = {};
  const emptyPinnedSet = new Set<string>();
  const { dashboardLinks, dashboardLinkBySlug } = buildDashboardLinkSummaries(
    emptyClickStats,
    emptyPinnedSet,
    locale,
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
  locale: AppLocale = DEFAULT_LOCALE,
): Promise<DashboardLinksData> {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) throw new Error("Dashboard link user ID is required");
  return withUserDbContext(normalizedUserId, async () => {
    const clickRows = await prisma.dashboardLinkClick.findMany({
      where: { userId: normalizedUserId },
      select: { slug: true, count: true },
    });
    const pinRows = await prisma.dashboardLinkPin.findMany({
      where: { userId: normalizedUserId },
      select: { slug: true },
      orderBy: { createdAt: "asc" },
    });
    const clickStats: Record<string, number> = Object.fromEntries(
      clickRows.map((row) => [row.slug, row.count]),
    );
    const pinnedSlugSet = new Set(pinRows.map((row) => row.slug));

    const { dashboardLinks, dashboardLinkBySlug } = buildDashboardLinkSummaries(
      clickStats,
      pinnedSlugSet,
      locale,
    );
    const pinnedLinks = dashboardLinksForSlugs(
      pinRows.map((row) => row.slug),
      dashboardLinkBySlug,
    );
    const recommendedLinks = recommendedDashboardLinkSummaries(
      clickStats,
      pinnedSlugSet,
      locale,
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
  });
}

export async function getLinksTabData(
  userId: string,
  locale: AppLocale = DEFAULT_LOCALE,
) {
  return getSignedInDashboardLinksData(userId, locale);
}
