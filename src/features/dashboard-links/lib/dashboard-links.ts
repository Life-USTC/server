import {
  DASHBOARD_LINK_GROUP_ORDER,
  DASHBOARD_LINK_GROUPS,
  type DashboardLinkGroup,
  type DashboardLinkItem,
  USTC_DASHBOARD_LINKS,
} from "./dashboard-link-catalog";

export {
  DASHBOARD_LINK_GROUP_ORDER,
  DASHBOARD_LINK_GROUPS,
  type DashboardLinkCategory,
  type DashboardLinkGroup,
  type DashboardLinkIcon,
  type DashboardLinkItem,
  USTC_DASHBOARD_LINKS,
} from "./dashboard-link-catalog";

const DASHBOARD_LINK_GROUP_BY_SLUG: Record<string, DashboardLinkGroup> =
  Object.fromEntries(
    DASHBOARD_LINK_GROUP_ORDER.flatMap((group) =>
      DASHBOARD_LINK_GROUPS[group].map((slug) => [slug, group] as const),
    ),
  );

export function getDashboardLinkGroup(slug: string): DashboardLinkGroup {
  return DASHBOARD_LINK_GROUP_BY_SLUG[slug] ?? "leastClicked";
}

export type LinkClickStats = Record<string, number>;

export function recommendDashboardLinks(
  clickStats: LinkClickStats,
  options: {
    limit?: number;
    excludeSlugs?: string[];
  } = {},
): DashboardLinkItem[] {
  const limit = options.limit ?? 3;
  const excluded = new Set(options.excludeSlugs ?? []);
  const candidateLinks = USTC_DASHBOARD_LINKS.filter(
    (link) => !excluded.has(link.slug),
  );

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
