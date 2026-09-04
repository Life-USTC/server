import { getSignedInDashboardLinksData } from "@/features/dashboard-links/server/dashboard-link-data";
import { type AppLocale, DEFAULT_LOCALE } from "@/i18n/config";

const EMPTY_DASHBOARD_OVERVIEW_LINKS = {
  dashboardLinks: [],
  recommendedLinks: [],
  pinnedLinks: [],
  overviewLinks: [],
};

export function getDashboardOverviewLinksData(
  userId: string,
  {
    locale = DEFAULT_LOCALE,
    skipLinks,
  }: { locale?: AppLocale; skipLinks?: boolean },
) {
  if (skipLinks) {
    return Promise.resolve(EMPTY_DASHBOARD_OVERVIEW_LINKS);
  }
  return getSignedInDashboardLinksData(userId, locale);
}
