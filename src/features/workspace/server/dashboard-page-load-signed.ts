import { serializeDashboardOverview } from "@/features/workspace/server/dashboard-overview-serialization";
import type { WorkspacePageCopy } from "@/features/workspace/server/dashboard-page-load-types";
import {
  loadSignedDashboardTabData,
  timeDashboardStage,
} from "@/features/workspace/server/dashboard-page-tab-data";
import {
  createDashboardStageCounter,
  markDashboardStageCountsUnknown,
} from "@/features/workspace/server/dashboard-stage-analytics";
import type { AppLocale } from "@/i18n/config";
import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";

export async function loadSignedDashboardPageData(input: {
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
  const dashboard = await import(
    "@/features/workspace/server/dashboard-overview-data"
  );
  const userContextCounter = createDashboardStageCounter({
    dbContext: "rls",
    dbLabel: "app",
  });
  const context = await timeDashboardStage(
    "user_context",
    {
      requestId: input.requestId,
      tab: input.tab,
    },
    () => dashboard.getDashboardUserContext(input.userId, userContextCounter),
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

  const tabCounter = createDashboardStageCounter({
    dbContext: "mixed",
    dbLabel: "app",
  });
  markDashboardStageCountsUnknown(tabCounter);
  const {
    bus,
    calendarSubscriptionUrl,
    homeworks,
    links,
    navStats,
    overview,
    subscriptions,
    todos,
  } = await timeDashboardStage(
    "tab",
    {
      requestId: input.requestId,
      subscribedSectionCount: context.sectionIds.length,
      tab: input.tab,
    },
    () =>
      loadSignedDashboardTabData({
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
    copy: input.pageCopy,
    locale: input.locale,
    referenceNow: toShanghaiIsoString(input.referenceNow ?? new Date()),
    signedIn: true,
    tab: input.tab,
    overviewWeek: input.overviewWeek,
    navStats,
    subscribedSectionCount: context.sectionIds.length,
    overview: overview ? serializeDashboardOverview(overview) : null,
    links,
    homeworks,
    subscriptions,
    calendarSubscriptionUrl:
      subscriptions?.calendarSubscriptionUrl ?? calendarSubscriptionUrl ?? null,
    todos,
    bus: bus?.data ?? null,
  };
}
