import {
  localizeDashboardLinks,
  recommendDashboardLinks,
  USTC_DASHBOARD_LINKS,
} from "@/features/dashboard-links/lib/dashboard-links";
import { type AppLocale, DEFAULT_LOCALE } from "@/i18n/config";
import { toDashboardLinkSummary } from "./dashboard-link-summary";

export function buildDashboardLinkSummaries(
  clickStats: Record<string, number>,
  pinnedSlugSet: Set<string>,
  locale: AppLocale = DEFAULT_LOCALE,
) {
  const dashboardLinks = localizeDashboardLinks(
    USTC_DASHBOARD_LINKS,
    locale,
  ).map((link) => toDashboardLinkSummary(link, clickStats, pinnedSlugSet));

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
  locale: AppLocale = DEFAULT_LOCALE,
) {
  return recommendDashboardLinks(clickStats, {
    locale,
    limit: USTC_DASHBOARD_LINKS.length,
    excludeSlugs: Array.from(pinnedSlugSet),
  }).map((link) => toDashboardLinkSummary(link, clickStats, pinnedSlugSet));
}
