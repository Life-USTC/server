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
import { logAppEvent } from "@/lib/log/app-logger";

function recordDashboardLoadFinish(input: {
  durationMs: number;
  requestId: string | undefined;
  signedIn: boolean;
  status: "ok" | "user-missing";
  subscribedSectionCount?: number;
  tab: string;
}) {
  logAppEvent("info", "dashboard.load.finish", {
    durationMs: input.durationMs,
    event: "dashboard.load.finish",
    requestId: input.requestId,
    signedIn: input.signedIn,
    source: "dashboard",
    status: input.status,
    subscribedSectionCount: input.subscribedSectionCount,
    tab: input.tab,
  });
}

export async function loadDashboardPage({
  locals,
  request,
  url,
}: DashboardPageLoadEvent) {
  const startMs = Date.now();
  const locale = locals.locale as AppLocale;
  const pageCopy = getDashboardPageCopy(locale);
  const userId = locals.authUser?.id ?? (await getDashboardUserId(request));
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
    const data = loadAnonymousDashboardPageData({
      counts: publicSummary.counts,
      locale,
      overviewLinks: publicSummary.links.overviewLinks,
      pageCopy,
      publicLinks: publicSummary.links.dashboardLinks,
      tab,
    });
    recordDashboardLoadFinish({
      durationMs: Date.now() - startMs,
      requestId: locals.requestId,
      signedIn: false,
      status: "ok",
      tab,
    });
    return data;
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
  recordDashboardLoadFinish({
    durationMs: Date.now() - startMs,
    requestId: locals.requestId,
    signedIn: true,
    status: "userMissing" in signedData ? "user-missing" : "ok",
    subscribedSectionCount:
      "subscribedSectionCount" in signedData
        ? signedData.subscribedSectionCount
        : undefined,
    tab,
  });

  return {
    ...signedData,
    counts: publicSummary.counts,
    currentTermName: publicSummary.currentTermName,
  };
}
