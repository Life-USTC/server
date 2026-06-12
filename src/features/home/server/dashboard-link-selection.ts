import {
  recommendDashboardLinks,
  USTC_DASHBOARD_LINKS,
} from "@/features/dashboard-links/lib/dashboard-links";
import { toDashboardLinkSummary } from "./dashboard-link-summary";

export function buildDashboardLinkSummaries(
  clickStats: Record<string, number>,
  pinnedSlugSet: Set<string>,
) {
  const dashboardLinks = USTC_DASHBOARD_LINKS.map((link) =>
    toDashboardLinkSummary(link, clickStats, pinnedSlugSet),
  );

  return {
    dashboardLinks,
    dashboardLinkBySlug: new Map(
      dashboardLinks.map((link) => [link.slug, link] as const),
    ),
  };
}

export function dashboardLinksForSlugs<Link>(
  slugs: string[],
  dashboardLinkBySlug: Map<string, Link>,
) {
  return slugs.flatMap((slug) => {
    const link = dashboardLinkBySlug.get(slug);
    return link ? [link] : [];
  });
}

export function recommendedDashboardLinkSummaries(
  clickStats: Record<string, number>,
  pinnedSlugSet: Set<string>,
) {
  return recommendDashboardLinks(clickStats, {
    limit: USTC_DASHBOARD_LINKS.length,
    excludeSlugs: Array.from(pinnedSlugSet),
  }).map((link) => toDashboardLinkSummary(link, clickStats, pinnedSlugSet));
}
