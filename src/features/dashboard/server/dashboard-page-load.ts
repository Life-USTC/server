import { isSignedDashboardTab } from "@/features/dashboard/lib/dashboard-nav";
import { getDashboardPageCopy } from "@/features/dashboard/server/dashboard-page-copy";
import { loadSignedDashboardPageData } from "@/features/dashboard/server/dashboard-page-load-signed";
import type { DashboardPageLoadEvent } from "@/features/dashboard/server/dashboard-page-load-types";
import { loadDashboardPublicSummaryWithFallback } from "@/features/dashboard/server/dashboard-page-public-summary";
import {
  normalizeDashboardTab,
  parsePositiveCalendarSemester,
  parseSnapshotReferenceTime,
} from "@/features/dashboard/server/dashboard-page-server";
import { logAppEvent } from "@/lib/log/app-logger";

function recordDashboardLoadFinish(input: {
  durationMs: number;
  requestId: string | undefined;
  status: "ok" | "user-missing";
  subscribedSectionCount?: number;
  tab: string;
}) {
  logAppEvent("info", "dashboard.load.finish", {
    durationMs: input.durationMs,
    event: "dashboard.load.finish",
    requestId: input.requestId,
    signedIn: true,
    source: "dashboard",
    status: input.status,
    subscribedSectionCount: input.subscribedSectionCount,
    tab: input.tab,
  });
}

export async function loadSignedDashboardPage({
  locals,
  url,
  userId,
}: DashboardPageLoadEvent & { userId: string }) {
  const startMs = Date.now();
  const locale = locals.locale;
  const pageCopy = getDashboardPageCopy(locale);
  const calendarSemesterId =
    url.searchParams.get("tab") === "calendar"
      ? parsePositiveCalendarSemester(url.searchParams.get("calendarSemester"))
      : undefined;
  const tab = normalizeDashboardTab(url.searchParams.get("tab"), true);
  const referenceNow = parseSnapshotReferenceTime(
    url.searchParams.get("snapshotAt"),
  );

  const publicSummaryPromise = loadDashboardPublicSummaryWithFallback(
    locale,
    referenceNow ?? null,
  );

  const signedTab = isSignedDashboardTab(tab) ? tab : "overview";
  const [publicSummary, signedData] = await Promise.all([
    publicSummaryPromise,
    loadSignedDashboardPageData({
      calendarSemesterId,
      locale,
      overviewWeek: url.searchParams.get("overviewWeek"),
      pageCopy,
      referenceNow,
      requestId: locals.requestId,
      tab,
      userId,
    }),
  ]);
  recordDashboardLoadFinish({
    durationMs: Date.now() - startMs,
    requestId: locals.requestId,
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
    mainContentLabel: pageCopy.dashboard.nav[signedTab].title,
  };
}
