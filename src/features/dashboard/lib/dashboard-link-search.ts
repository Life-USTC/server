import {
  DASHBOARD_LINK_GROUP_ORDER,
  type DashboardLinkGroup,
} from "@/features/dashboard-links/lib/dashboard-links";

export type DashboardLinkSearchable = {
  description: string;
  descriptionPinyin: string;
  group: DashboardLinkGroup;
  title: string;
  titlePinyin: string;
};

export function searchQueryToTokens(query: string) {
  return query
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .split(" ")
    .filter(Boolean);
}

export function linkMatchesTokens(
  link: DashboardLinkSearchable,
  tokens: string[],
) {
  const title = link.title.toLowerCase();
  const description = link.description.toLowerCase();
  return tokens.every(
    (token) =>
      title.includes(token) ||
      description.includes(token) ||
      link.titlePinyin.includes(token) ||
      link.descriptionPinyin.includes(token),
  );
}

export function groupDashboardLinks<Link extends DashboardLinkSearchable>(
  links: Link[],
  query: string,
  labels: Record<DashboardLinkGroup, string>,
) {
  const tokens = searchQueryToTokens(query);
  const visibleLinks =
    tokens.length === 0
      ? links
      : links.filter((link) => linkMatchesTokens(link, tokens));

  return DASHBOARD_LINK_GROUP_ORDER.map((group) => ({
    group,
    label: labels[group],
    links: visibleLinks.filter((link) => link.group === group),
  })).filter((entry) => entry.links.length > 0);
}
