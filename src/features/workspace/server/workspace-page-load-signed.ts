import { homeworkCapabilities } from "@/features/homeworks/lib/homework-capabilities";
import { serializeWorkspaceOverview } from "@/features/workspace/server/workspace-overview-serialization";
import type { WorkspacePageCopy } from "@/features/workspace/server/workspace-page-load-types";
import {
  loadSignedWorkspaceTabData,
  timeWorkspaceStage,
} from "@/features/workspace/server/workspace-page-tab-data";
import {
  countWorkspaceStageQuery,
  createWorkspaceStageCounter,
  markWorkspaceStageCountsUnknown,
} from "@/features/workspace/server/workspace-stage-analytics";
import type { AppLocale } from "@/i18n/config";
import { getViewerContext } from "@/lib/auth/viewer-context";
import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";

export async function loadSignedWorkspacePageData(input: {
  calendarSemesterId: number | undefined;
  locale: AppLocale;
  overviewWeek: string | null;
  pageCopy: WorkspacePageCopy;
  referenceNow: Date | null | undefined;
  revealCalendarFeed?: boolean;
  requestId: string | undefined;
  tab: string;
  userId: string;
}) {
  // Read the shell identity and subscription scope in its own short RLS
  // transaction. The tab read models below deliberately own their RLS
  // contexts so their fixed fan-out can use separate pool connections.
  const workspaceModule = await import(
    "@/features/workspace/server/workspace-overview-data"
  );
  const userContextCounter = createWorkspaceStageCounter({
    dbContext: "rls",
    dbLabel: "app",
  });
  const { context, capabilities } = await timeWorkspaceStage(
    "user_context",
    {
      requestId: input.requestId,
      tab: input.tab,
    },
    async () => {
      const [context, viewer] = await Promise.all([
        workspaceModule.getWorkspaceUserContext(
          input.userId,
          userContextCounter,
        ),
        input.tab === "homeworks"
          ? getViewerContext({
              userId: input.userId,
              instrumentation: {
                onQuery: () => countWorkspaceStageQuery(userContextCounter),
              },
            })
          : undefined,
      ]);
      return {
        context,
        capabilities: viewer ? homeworkCapabilities(viewer) : undefined,
      };
    },
    userContextCounter,
  );

  if (!context) {
    return {
      copy: input.pageCopy,
      locale: input.locale,
      signedIn: true,
      tab: input.tab,
      userMissing: true,
    };
  }

  const tabCounter = createWorkspaceStageCounter({
    dbContext: "mixed",
    dbLabel: "app",
  });
  markWorkspaceStageCountsUnknown(tabCounter);
  const {
    bus,
    calendarSubscriptionUrl,
    homeworks,
    links,
    navStats,
    overview,
    subscriptions,
    todos,
  } = await timeWorkspaceStage(
    "tab",
    {
      requestId: input.requestId,
      subscribedSectionCount: context.sectionIds.length,
      tab: input.tab,
    },
    () =>
      loadSignedWorkspaceTabData({
        calendarSemesterId: input.calendarSemesterId,
        context,
        locale: input.locale,
        overviewWeek: input.overviewWeek,
        referenceNow: input.referenceNow ?? undefined,
        requestId: input.requestId,
        revealCalendarFeed: input.revealCalendarFeed,
        tab: input.tab,
        userId: input.userId,
      }),
    tabCounter,
  );

  return {
    homeworkCapabilities: capabilities,
    copy: input.pageCopy,
    locale: input.locale,
    referenceNow: toShanghaiIsoString(input.referenceNow ?? new Date()),
    signedIn: true,
    tab: input.tab,
    overviewWeek: input.overviewWeek,
    navStats,
    subscribedSectionCount: context.sectionIds.length,
    overview: overview ? serializeWorkspaceOverview(overview) : null,
    links,
    homeworks,
    subscriptions,
    calendarSubscriptionUrl:
      subscriptions?.calendarSubscriptionUrl ?? calendarSubscriptionUrl ?? null,
    todos,
    bus: bus?.data ?? null,
  };
}
