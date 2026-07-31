import {
  dashboardLinkItemMatchesTokens,
  searchQueryToTokens,
} from "@/features/dashboard-links/lib/dashboard-link-search";
import {
  localizeDashboardLink,
  USTC_DASHBOARD_LINKS,
} from "@/features/dashboard-links/lib/dashboard-links";
import type { AppLocale } from "@/i18n/config";

const MIN_QUERY_LENGTH = 2;

export function searchLinksForGlobal(
  query: string,
  locale: AppLocale,
  limit: number,
) {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return [];

  const tokens = searchQueryToTokens(trimmed);
  if (tokens.length === 0) return [];

  return USTC_DASHBOARD_LINKS.filter((link) =>
    dashboardLinkItemMatchesTokens(link, tokens),
  )
    .slice(0, limit)
    .map((link) => {
      const localized = localizeDashboardLink(link, locale);
      return {
        description: localized.description,
        slug: localized.slug,
        title: localized.title,
        url: localized.url,
      };
    });
}
