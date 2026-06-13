import { serializeDashboardOverview } from "@/features/dashboard/server/dashboard-overview-serialization";
import type { DashboardPageCopy } from "@/features/dashboard/server/dashboard-page-load-types";
import { loadSignedDashboardTabData } from "@/features/dashboard/server/dashboard-page-tab-data";
import type { AppLocale } from "@/i18n/config";
import { logAppEvent } from "@/lib/log/app-logger";
import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";

async function timeSignedDashboardStage<T>(
  stage: string,
  input: {
    requestId: string | undefined;
    subscribedSectionCount?: number;
    tab: string;
  },
  work: () => Promise<T>,
) {
  const startMs = Date.now();
  try {
    const result = await work();
    logAppEvent("info", "dashboard.load.stage", {
      durationMs: Date.now() - startMs,
      event: "dashboard.load.stage",
      requestId: input.requestId,
      source: "dashboard",
      stage,
      status: "ok",
      subscribedSectionCount: input.subscribedSectionCount,
      tab: input.tab,
    });
    return result;
  } catch (error) {
    logAppEvent("warn", "dashboard.load.stage", {
      durationMs: Date.now() - startMs,
      event: "dashboard.load.stage",
      requestId: input.requestId,
      source: "dashboard",
      stage,
      status: "error",
      subscribedSectionCount: input.subscribedSectionCount,
      tab: input.tab,
    });
    throw error;
  }
}

export async function loadSignedDashboardPageData(input: {
  calendarSemesterId: number | undefined;
  locale: AppLocale;
  overviewWeek: string | null;
  pageCopy: DashboardPageCopy;
  referenceNow: Date | null | undefined;
  requestId: string | undefined;
  tab: string;
  userId: string;
}) {
  const dashboard = await import(
    "@/features/home/server/dashboard-overview-data"
  );
  const context = await timeSignedDashboardStage(
    "user-context",
    {
      requestId: input.requestId,
      tab: input.tab,
    },
    () => dashboard.getDashboardUserContext(input.userId),
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

  const {
    bus,
    calendarSubscriptionUrl,
    homeworks,
    links,
    navStats,
    overview,
    subscriptions,
    todos,
  } = await timeSignedDashboardStage(
    "tab-data",
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
        referenceNow: input.referenceNow ?? undefined,
        requestId: input.requestId,
        tab: input.tab,
        userId: input.userId,
      }),
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
