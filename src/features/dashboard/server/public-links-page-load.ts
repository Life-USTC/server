import { getPublicLinksPageCopy } from "@/features/dashboard/server/dashboard-page-copy";
import type { DashboardPageLoadEvent } from "@/features/dashboard/server/dashboard-page-load-types";
import { getPublicDashboardLinksData } from "@/features/dashboard-links/server/dashboard-link-data";

export async function loadPublicLinksPage({ locals }: DashboardPageLoadEvent) {
  const publicLinks = await getPublicDashboardLinksData(locals.locale);

  return {
    copy: getPublicLinksPageCopy(locals.locale),
    locale: locals.locale,
    publicLinks: publicLinks.dashboardLinks,
  };
}
