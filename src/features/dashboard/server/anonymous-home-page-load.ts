import { getAnonymousHomePageCopy } from "@/features/dashboard/server/dashboard-page-copy";
import { loadAnonymousDashboardPageData } from "@/features/dashboard/server/dashboard-page-load-public";
import type { DashboardPageLoadEvent } from "@/features/dashboard/server/dashboard-page-load-types";
import { normalizeDashboardTab } from "@/features/dashboard/server/dashboard-page-server";
import { getPublicDashboardLinksData } from "@/features/dashboard-links/server/dashboard-link-data";
import { logAppEvent } from "@/lib/log/app-logger";

export async function loadAnonymousHomePage({
  locals,
  url,
}: DashboardPageLoadEvent) {
  const startMs = Date.now();
  const locale = locals.locale;
  const tab = normalizeDashboardTab(url.searchParams.get("tab"), false);
  const publicLinks = await getPublicDashboardLinksData(locale);
  const data = await loadAnonymousDashboardPageData({
    locale,
    pageCopy: getAnonymousHomePageCopy(locale),
    publicLinks: publicLinks.dashboardLinks,
    tab,
  });

  logAppEvent("info", "dashboard.load.finish", {
    durationMs: Date.now() - startMs,
    event: "dashboard.load.finish",
    requestId: locals.requestId,
    signedIn: false,
    source: "dashboard",
    status: "ok",
    tab,
  });

  return data;
}
