import type { WorkspaceTabId } from "@/features/dashboard/lib/dashboard-nav";
import { getDashboardPageCopy } from "@/features/dashboard/server/dashboard-page-copy";
import { loadSignedDashboardPageData } from "@/features/dashboard/server/dashboard-page-load-signed";
import type { DashboardPageLoadEvent } from "@/features/dashboard/server/dashboard-page-load-types";
import {
  parsePositiveCalendarSemester,
  parseSnapshotReferenceTime,
} from "@/features/dashboard/server/dashboard-page-server";
import { logAppEvent } from "@/lib/log/app-logger";

function recordDashboardLoadFinish(input: {
  ioObservedDurationMs: number;
  requestId: string | undefined;
  status: "ok" | "user-missing";
  subscribedSectionCount?: number;
  tab: string;
}) {
  logAppEvent("info", "dashboard.load.finish", {
    event: "dashboard.load.finish",
    ioObservedDurationMs: input.ioObservedDurationMs,
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
  request,
  tab,
  url,
  userId,
}: DashboardPageLoadEvent & { tab: WorkspaceTabId; userId: string }) {
  const startMs = Date.now();
  const locale = locals.locale;
  const pageCopy = getDashboardPageCopy(locale);
  const calendarSemesterId =
    tab === "calendar"
      ? parsePositiveCalendarSemester(url.searchParams.get("calendarSemester"))
      : undefined;
  const referenceNow = parseSnapshotReferenceTime(
    url.searchParams.get("snapshotAt"),
  );
  // Keep the auth module out of anonymous workspace requests. Cloudflare can
  // otherwise evaluate Better Auth in the redirecting request's I/O context
  // before the first authenticated request initializes it.
  const { resolveAuthoritativeRecentSession } = await import(
    "@/lib/auth/recent-session"
  );
  const recent = await resolveAuthoritativeRecentSession(request.headers, {
    expectedUserId: userId,
  });

  const signedData = await loadSignedDashboardPageData({
    calendarSemesterId,
    locale,
    overviewWeek: url.searchParams.get("overviewWeek"),
    pageCopy,
    referenceNow,
    requestId: locals.requestId,
    revealCalendarFeed: recent.ok,
    tab,
    userId,
  });
  recordDashboardLoadFinish({
    ioObservedDurationMs: Date.now() - startMs,
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
    mainContentLabel: pageCopy.dashboard.nav[tab].title,
  };
}
