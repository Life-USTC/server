import { type AppLocale, DEFAULT_LOCALE } from "@/i18n/config";
import {
  type CatalogLinkGroup,
  DASHBOARD_LINK_GROUP_ORDER,
  DASHBOARD_LINK_GROUPS,
  type LocalizedCatalogLinkItem,
  localizeCatalogLinks,
  USTC_CATALOG_LINKS,
} from "./catalog-link-catalog";

export {
  type CatalogLinkGroup,
  type CatalogLinkIcon,
  type CatalogLinkItem,
  DASHBOARD_LINK_GROUP_ORDER,
  DASHBOARD_LINK_GROUPS,
  type DashboardLinkCategory,
  type LocalizedCatalogLinkItem,
  localizeCatalogLink,
  localizeCatalogLinks,
  USTC_CATALOG_LINKS,
} from "./catalog-link-catalog";

const DASHBOARD_LINK_GROUP_BY_SLUG: Record<string, CatalogLinkGroup> =
  Object.fromEntries(
    DASHBOARD_LINK_GROUP_ORDER.flatMap((group) =>
      DASHBOARD_LINK_GROUPS[group].map((slug) => [slug, group] as const),
    ),
  );

export function getCatalogLinkGroup(slug: string): CatalogLinkGroup {
  return DASHBOARD_LINK_GROUP_BY_SLUG[slug] ?? "leastClicked";
}

export type LinkClickStats = Record<string, number>;

/** Tracking redirect that records an authenticated visit then 307s to the target. */
export function dashboardLinkVisitHref(slug: string) {
  return `/api/catalog/links/resolve?slug=${encodeURIComponent(slug)}`;
}

export function recommendCatalogLinks(
  clickStats: LinkClickStats,
  options: {
    locale?: AppLocale;
    limit?: number;
    excludeSlugs?: string[];
  } = {},
): LocalizedCatalogLinkItem[] {
  const locale = options.locale ?? DEFAULT_LOCALE;
  const limit = options.limit ?? 3;
  const excluded = new Set(options.excludeSlugs ?? []);
  const candidateLinks = localizeCatalogLinks(
    USTC_CATALOG_LINKS,
    locale,
  ).filter((link) => !excluded.has(link.slug));

  return [...candidateLinks]
    .sort((left, right) => {
      const rightCount = clickStats[right.slug] ?? 0;
      const leftCount = clickStats[left.slug] ?? 0;
      if (rightCount === leftCount) {
        return left.title.localeCompare(right.title, "zh-CN");
      }
      return rightCount - leftCount;
    })
    .slice(0, limit);
}
