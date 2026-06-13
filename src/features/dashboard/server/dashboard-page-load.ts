import { getDashboardPageCopy } from "@/features/dashboard/server/dashboard-page-copy";
import { loadAnonymousDashboardPageData } from "@/features/dashboard/server/dashboard-page-load-public";
import { loadSignedDashboardPageData } from "@/features/dashboard/server/dashboard-page-load-signed";
import type { DashboardPageLoadEvent } from "@/features/dashboard/server/dashboard-page-load-types";
import { loadDashboardPublicSummary } from "@/features/dashboard/server/dashboard-page-public-summary";
import {
  getDashboardUserId,
  normalizeDashboardTab,
  parsePositiveCalendarSemester,
  parseSnapshotReferenceTime,
} from "@/features/dashboard/server/dashboard-page-server";
import type { AppLocale } from "@/i18n/config";

export async function loadDashboardPage({
  locals,
  request,
  url,
}: DashboardPageLoadEvent) {
  const locale = locals.locale as AppLocale;
  const pageCopy = getDashboardPageCopy(locale);
  const userId = await getDashboardUserId(request);
  const calendarSemesterId =
    url.searchParams.get("tab") === "calendar"
      ? parsePositiveCalendarSemester(url.searchParams.get("calendarSemester"))
      : undefined;
  const tab = normalizeDashboardTab(
    url.searchParams.get("tab"),
    Boolean(userId),
  );
  const referenceNow = parseSnapshotReferenceTime(
    url.searchParams.get("snapshotAt"),
  );

  const publicSummaryPromise = (async () => {
    let publicSummary: Awaited<ReturnType<typeof loadDashboardPublicSummary>>;
    try {
      const { getPrisma } = await import("@/lib/db/prisma");
      publicSummary = await loadDashboardPublicSummary(
        getPrisma(locale),
        referenceNow ?? null,
      );
    } catch {
      publicSummary = await loadDashboardPublicSummary(
        null,
        referenceNow ?? null,
      );
    }
    return publicSummary;
  })();

  if (!userId) {
    const publicSummary = await publicSummaryPromise;
    return loadAnonymousDashboardPageData({
      counts: publicSummary.counts,
      locale,
      overviewLinks: publicSummary.links.overviewLinks,
      pageCopy,
      publicLinks: publicSummary.links.dashboardLinks,
      tab,
    });
  }

  const [publicSummary, signedData] = await Promise.all([
    publicSummaryPromise,
    loadSignedDashboardPageData({
      calendarSemesterId,
      locale,
      overviewWeek: url.searchParams.get("overviewWeek"),
      pageCopy,
      referenceNow,
      tab,
      userId,
    }),
  ]);

  return {
    ...signedData,
    counts: publicSummary.counts,
    currentTermName: publicSummary.currentTermName,
  };
}
