import type { DashboardUserContext } from "@/features/home/server/dashboard-user-context";
import type { AppLocale } from "@/i18n/config";
import { logAppEvent } from "@/lib/log/app-logger";

function inactiveStage<T>(value: T) {
  return Promise.resolve(value);
}

async function timeDashboardTabStage<T>(
  stage: string,
  input: {
    requestId: string | undefined;
    subscribedSectionCount: number;
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

export async function loadSignedDashboardTabData(input: {
  calendarSemesterId: number | undefined;
  context: DashboardUserContext;
  locale: AppLocale;
  referenceNow: Date | undefined;
  requestId: string | undefined;
  tab: string;
  userId: string;
}) {
  const [dashboard, dashboardTabs, dashboardLinks] = await Promise.all([
    import("@/features/home/server/dashboard-overview-data"),
    import("@/features/home/server/dashboard-tab-data"),
    import("@/features/home/server/dashboard-link-data"),
  ]);
  const stageContext = {
    requestId: input.requestId,
    subscribedSectionCount: input.context.sectionIds.length,
    tab: input.tab,
  };

  const [
    navStats,
    overview,
    links,
    homeworks,
    subscriptions,
    calendarSubscriptionUrl,
    todos,
    bus,
  ] = await Promise.all([
    timeDashboardTabStage("nav-stats", stageContext, () =>
      dashboard.getDashboardNavStats(
        input.context.user,
        input.context.subscribedSections,
        input.referenceNow,
      ),
    ),
    input.tab === "overview" || input.tab === "calendar"
      ? timeDashboardTabStage("overview", stageContext, () =>
          dashboard.getDashboardOverviewData(input.userId, {
            locale: input.locale,
            user: input.context.user,
            sectionIds: input.context.sectionIds,
            calendarSemesterId: input.calendarSemesterId,
            referenceNow: input.referenceNow,
            skipLinks: input.tab === "calendar",
          }),
        )
      : inactiveStage(null),
    input.tab === "links"
      ? timeDashboardTabStage("links", stageContext, () =>
          dashboardLinks.getLinksTabData(input.userId),
        )
      : inactiveStage(null),
    input.tab === "homeworks"
      ? timeDashboardTabStage("homeworks", stageContext, () =>
          dashboardTabs.getHomeworksTabData(input.userId, input.locale, {
            sectionIds: input.context.sectionIds,
          }),
        )
      : inactiveStage(null),
    input.tab === "subscriptions" || input.tab === "exams"
      ? timeDashboardTabStage("subscriptions", stageContext, () =>
          dashboardTabs.getSubscriptionsTabData(input.userId, input.locale, {
            includeExams: input.tab === "exams",
            sectionIds: input.context.sectionIds,
          }),
        )
      : inactiveStage(null),
    input.tab === "calendar"
      ? timeDashboardTabStage("calendar-subscription", stageContext, () =>
          dashboardTabs.getCalendarSubscriptionUrl(
            input.userId,
            input.context.user.calendarFeedToken,
          ),
        )
      : inactiveStage(null),
    input.tab === "todos" || input.tab === "overview"
      ? timeDashboardTabStage("todos", stageContext, () =>
          dashboardTabs.getTodosTabData(input.userId),
        )
      : inactiveStage(null),
    input.tab === "bus"
      ? timeDashboardTabStage("bus", stageContext, () =>
          dashboardTabs.getBusTabData(input.userId, input.locale),
        )
      : inactiveStage(null),
  ]);

  return {
    bus,
    calendarSubscriptionUrl,
    homeworks,
    links,
    navStats,
    overview,
    subscriptions,
    todos,
  };
}
