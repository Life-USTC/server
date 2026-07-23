import { getDashboardPageCopy } from "@/features/dashboard/server/dashboard-page-copy";
import type { DashboardPageLoadEvent } from "@/features/dashboard/server/dashboard-page-load-types";
import { getDashboardUserId } from "@/features/dashboard/server/dashboard-page-server";
import {
  getPublicDashboardLinksData,
  getSignedInDashboardLinksData,
} from "@/features/dashboard-links/server/dashboard-link-data";

export async function loadPublicLinksPage({
  locals,
  request,
}: DashboardPageLoadEvent) {
  const userId = await getDashboardUserId(request);
  const links = await (userId
    ? getSignedInDashboardLinksData(userId, locals.locale)
    : getPublicDashboardLinksData(locals.locale));

  return {
    copy: getDashboardPageCopy(locals.locale),
    locale: locals.locale,
    links: links.dashboardLinks,
    signedIn: Boolean(userId),
  };
}
