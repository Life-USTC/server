import { getSignedInDashboardLinksData } from "./dashboard-link-data";

const EMPTY_DASHBOARD_OVERVIEW_LINKS = {
  dashboardLinks: [],
  recommendedLinks: [],
  pinnedLinks: [],
  overviewLinks: [],
};

export function getDashboardOverviewLinksData(
  userId: string,
  { skipLinks }: { skipLinks?: boolean },
) {
  if (skipLinks) {
    return Promise.resolve(EMPTY_DASHBOARD_OVERVIEW_LINKS);
  }
  return getSignedInDashboardLinksData(userId);
}
