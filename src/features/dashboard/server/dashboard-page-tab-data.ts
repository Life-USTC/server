import type { DashboardUserContext } from "@/features/dashboard/server/dashboard-user-context";
import type { AppLocale } from "@/i18n/config";
import { withUserDbContext } from "@/lib/db/prisma";
import { logAppEvent } from "@/lib/log/app-logger";
import { elapsedMs, monotonicNowMs } from "@/lib/log/observability-clock";
import {
  createDashboardStageCounter,
  type DashboardStage,
  type DashboardStageCounter,
  recordDashboardStageAnalytics,
} from "./dashboard-stage-analytics";

const DASHBOARD_STAGES = new Set<DashboardStage>([
  "recent_session",
  "user_context",
  "nav_stats",
  "tab",
]);

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
  counter?: DashboardStageCounter,
) {
  const startMs = monotonicNowMs();
  let status: "error" | "ok" = "error";
  let stageError: unknown;
  try {
    const result = await work();
    status = "ok";
    return result;
  } catch (error) {
    stageError = error;
    throw error;
  } finally {
    logAppEvent(
      status === "ok" ? "info" : "warn",
      "dashboard.load.stage",
      {
        event: "dashboard.load.stage",
        ioObservedDurationMs: elapsedMs(startMs),
        requestId: input.requestId,
        source: "dashboard",
        stage,
        status,
        subscribedSectionCount: input.subscribedSectionCount,
        tab: input.tab,
      },
      stageError,
    );
    if (DASHBOARD_STAGES.has(stage as DashboardStage)) {
      recordDashboardStageAnalytics({
        counter,
        details: {
          subscribedSectionCount: input.subscribedSectionCount,
        },
        durationMs: elapsedMs(startMs),
        outcome: status === "ok" ? "success" : "error",
        stage: stage as DashboardStage,
      });
    }
  }
}

export async function loadSignedDashboardTabData(input: {
  calendarSemesterId: number | undefined;
  context: DashboardUserContext;
  locale: AppLocale;
  overviewWeek?: string | null;
  referenceNow: Date | undefined;
  revealCalendarFeed?: boolean;
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
  return withUserDbContext(input.userId, async () => {
    const shouldLoadTodos = input.tab === "todos" || input.tab === "overview";
    const semestersPromise = timeDashboardStage("semesters", stageContext, () =>
      dashboard.getDashboardSemesters(),
    );
    const todosPromise = shouldLoadTodos
      ? timeDashboardStage("todos", stageContext, () =>
          dashboardTabs.getTodosTabData(input.userId),
        )
      : inactiveStage(null);
    const pendingTodosCountPromise = shouldLoadTodos
      ? todosPromise.then(
          (items) => items?.filter((todo) => !todo.completed).length ?? 0,
        )
      : undefined;
    const navStatsCounter = createDashboardStageCounter({
      dbContext: "rls",
      dbLabel: "app",
    });
    const navStatsPromise = timeDashboardStage(
      "nav_stats",
      stageContext,
      async () =>
        dashboard.getDashboardNavStats(
          input.context.user,
          input.context.subscribedSections,
          input.referenceNow,
          pendingTodosCountPromise,
          await semestersPromise,
          navStatsCounter,
        ),
    );
    const overviewPromise =
      input.tab === "overview" || input.tab === "calendar"
        ? timeDashboardStage("overview", stageContext, async () => {
            const [semesters, overviewTodos] = await Promise.all([
              semestersPromise,
              todosPromise,
            ]);
            return dashboard.getDashboardOverviewData(input.userId, {
              calendarMode: input.tab === "calendar" ? "semester" : "preview",
              calendarSemesterId: input.calendarSemesterId,
              calendarTodos:
                overviewTodos?.flatMap((todo) =>
                  !todo.completed && todo.dueAt
                    ? [
                        {
                          completed: false,
                          content: todo.content,
                          dueAt: todo.dueAt,
                          id: todo.id,
                          priority: todo.priority,
                          title: todo.title,
                        },
                      ]
                    : [],
                ) ?? undefined,
              locale: input.locale,
              overviewWeek: input.overviewWeek,
              referenceNow: input.referenceNow,
              sectionIds: input.context.sectionIds,
              semesters,
              skipLinks: input.tab === "calendar",
              user: input.context.user,
            });
          })
        : inactiveStage(null);
    const linksPromise =
      input.tab === "links"
        ? timeDashboardStage("links", stageContext, () =>
            dashboardLinks.getLinksTabData(input.userId, input.locale),
          )
        : inactiveStage(null);
    const homeworksPromise =
      input.tab === "homeworks"
        ? timeDashboardStage("homeworks", stageContext, () =>
            dashboardTabs.getHomeworksTabData(input.userId, input.locale, {
              sectionIds: input.context.sectionIds,
            }),
          )
        : inactiveStage(null);
    const subscriptionsPromise =
      input.tab === "subscriptions" || input.tab === "exams"
        ? timeDashboardStage("subscriptions", stageContext, () =>
            dashboardTabs.getSubscriptionsTabData(input.userId, input.locale, {
              calendarFeedToken: input.revealCalendarFeed
                ? input.context.user.calendarFeedToken
                : undefined,
              includeExams: input.tab === "exams",
              sectionIds: input.context.sectionIds,
            }),
          )
        : inactiveStage(null);
    const calendarSubscriptionUrlPromise =
      input.tab === "calendar"
        ? timeDashboardStage("calendar-subscription", stageContext, () =>
            dashboardTabs.getCalendarSubscriptionUrl(
              input.userId,
              input.revealCalendarFeed
                ? input.context.user.calendarFeedToken
                : undefined,
            ),
          )
        : inactiveStage(null);
    const busPromise =
      input.tab === "bus"
        ? timeDashboardStage("bus", stageContext, () =>
            dashboardTabs.getBusTabData(input.userId, input.locale),
          )
        : inactiveStage(null);

    const [
      navStats,
      todos,
      overview,
      links,
      homeworks,
      subscriptions,
      calendarSubscriptionUrl,
      bus,
    ] = await Promise.all([
      navStatsPromise,
      todosPromise,
      overviewPromise,
      linksPromise,
      homeworksPromise,
      subscriptionsPromise,
      calendarSubscriptionUrlPromise,
      busPromise,
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
  });
}
