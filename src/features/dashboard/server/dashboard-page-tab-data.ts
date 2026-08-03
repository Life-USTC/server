import type { DashboardUserContext } from "@/features/dashboard/server/dashboard-user-context";
import type { AppLocale } from "@/i18n/config";
import { logAppEvent } from "@/lib/log/app-logger";

function inactiveStage<T>(value: T) {
  return Promise.resolve(value);
}

export async function timeDashboardStage<T>(
  stage: string,
  input: {
    requestId: string | undefined;
    subscribedSectionCount?: number;
    tab: string;
  },
  work: () => Promise<T>,
) {
  const startMs = Date.now();
  let status: "error" | "ok" = "error";
  try {
    const result = await work();
    status = "ok";
    return result;
  } finally {
    logAppEvent(status === "ok" ? "info" : "warn", "dashboard.load.stage", {
      event: "dashboard.load.stage",
      ioObservedDurationMs: Date.now() - startMs,
      requestId: input.requestId,
      source: "dashboard",
      stage,
      status,
      subscribedSectionCount: input.subscribedSectionCount,
      tab: input.tab,
    });
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
    import("@/features/dashboard/server/dashboard-overview-data"),
    import("@/features/dashboard/server/dashboard-tab-data"),
    import("@/features/dashboard-links/server/dashboard-link-data"),
  ]);
  const stageContext = {
    requestId: input.requestId,
    subscribedSectionCount: input.context.sectionIds.length,
    tab: input.tab,
  };
  const shouldLoadTodos = input.tab === "todos" || input.tab === "overview";
  const todosPromise = shouldLoadTodos
    ? timeDashboardStage("todos", stageContext, () =>
        dashboardTabs.getTodosTabData(input.userId),
      )
    : inactiveStage(null);
  const pendingTodosCountPromise = shouldLoadTodos
    ? todosPromise.then(
        (todos) => todos?.filter((todo) => !todo.completed).length ?? 0,
      )
    : undefined;

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
    timeDashboardStage("nav-stats", stageContext, () =>
      dashboard.getDashboardNavStats(
        input.context.user,
        input.context.subscribedSections,
        input.referenceNow,
        pendingTodosCountPromise,
      ),
    ),
    input.tab === "overview" || input.tab === "calendar"
      ? timeDashboardStage("overview", stageContext, () =>
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
      ? timeDashboardStage("links", stageContext, () =>
          dashboardLinks.getLinksTabData(input.userId, input.locale),
        )
      : inactiveStage(null),
    input.tab === "homeworks"
      ? timeDashboardStage("homeworks", stageContext, () =>
          dashboardTabs.getHomeworksTabData(input.userId, input.locale, {
            sectionIds: input.context.sectionIds,
          }),
        )
      : inactiveStage(null),
    input.tab === "subscriptions" || input.tab === "exams"
      ? timeDashboardStage("subscriptions", stageContext, () =>
          dashboardTabs.getSubscriptionsTabData(input.userId, input.locale, {
            calendarFeedToken: input.context.user.calendarFeedToken,
            includeExams: input.tab === "exams",
            sectionIds: input.context.sectionIds,
          }),
        )
      : inactiveStage(null),
    input.tab === "calendar"
      ? timeDashboardStage("calendar-subscription", stageContext, () =>
          dashboardTabs.getCalendarSubscriptionUrl(
            input.userId,
            input.context.user.calendarFeedToken,
          ),
        )
      : inactiveStage(null),
    todosPromise,
    input.tab === "bus"
      ? timeDashboardStage("bus", stageContext, () =>
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
