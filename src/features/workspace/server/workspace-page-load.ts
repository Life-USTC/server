import type { WorkspaceTabId } from "@/features/workspace/lib/workspace-nav";
import { getWorkspacePageCopy } from "@/features/workspace/server/workspace-page-copy";
import { loadSignedWorkspacePageData } from "@/features/workspace/server/workspace-page-load-signed";
import type { WorkspacePageLoadEvent } from "@/features/workspace/server/workspace-page-load-types";
import {
  parsePositiveCalendarSemester,
  parseSnapshotReferenceTime,
} from "@/features/workspace/server/workspace-page-server";
import {
  countWorkspaceStageQuery,
  createWorkspaceStageCounter,
  observeWorkspaceStage,
} from "@/features/workspace/server/workspace-stage-analytics";
import { logAppEvent } from "@/lib/log/app-logger";
import { elapsedMs, monotonicNowMs } from "@/lib/log/observability-clock";
import { runCloudflareTraceSpan } from "@/lib/ports/runtime";

function recordWorkspaceLoadFinish(input: {
  ioObservedDurationMs: number;
  requestId: string | undefined;
  status: "ok" | "user-missing";
  subscribedSectionCount?: number;
  tab: string;
}) {
  logAppEvent("info", "workspace.load.finish", {
    event: "workspace.load.finish",
    ioObservedDurationMs: input.ioObservedDurationMs,
    requestId: input.requestId,
    signedIn: true,
    source: "workspace",
    status: input.status,
    subscribedSectionCount: input.subscribedSectionCount,
    tab: input.tab,
  });
}

export async function loadSignedWorkspacePage({
  locals,
  request,
  tab,
  url,
  userId,
}: WorkspacePageLoadEvent & { tab: WorkspaceTabId; userId: string }) {
  const startMs = monotonicNowMs();
  const locale = locals.locale;
  const pageCopy = getWorkspacePageCopy(locale);
  const calendarSemesterId =
    tab === "calendar"
      ? parsePositiveCalendarSemester(url.searchParams.get("calendarSemester"))
      : undefined;
  const referenceNow = parseSnapshotReferenceTime(
    url.searchParams.get("snapshotAt"),
  );
  const shouldRevealCalendarFeed =
    tab === "calendar" || tab === "subscriptions" || tab === "exams";
  const recent = shouldRevealCalendarFeed
    ? await (async () => {
        const recentSessionCounter = createWorkspaceStageCounter({
          dbContext: "none",
          dbLabel: "auth",
        });
        // hooks.server.ts has already loaded this session using the same
        // Headers object. The recent-session stage only performs the
        // authoritative auth database reread below.
        countWorkspaceStageQuery(recentSessionCounter);
        return runCloudflareTraceSpan("recent_session", { tab }, () =>
          observeWorkspaceStage({
            counter: recentSessionCounter,
            stage: "recent_session",
            work: async () => {
              const { resolveAuthoritativeRecentSession } = await import(
                "@/lib/auth/recent-session"
              );
              return resolveAuthoritativeRecentSession(request.headers, {
                expectedUserId: userId,
              });
            },
          }),
        );
      })()
    : { ok: false as const };

  const signedData = await loadSignedWorkspacePageData({
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
  recordWorkspaceLoadFinish({
    ioObservedDurationMs: elapsedMs(startMs),
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
    mainContentLabel: pageCopy.workspace.nav[tab].title,
  };
}
