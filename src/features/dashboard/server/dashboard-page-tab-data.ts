import type { DashboardUserContext } from "@/features/home/server/dashboard-user-context";
import type { AppLocale } from "@/i18n/config";

export async function loadSignedDashboardTabData(input: {
  calendarSemesterId: number | undefined;
  context: DashboardUserContext;
  locale: AppLocale;
  referenceNow: Date | undefined;
  tab: string;
  userId: string;
}) {
  const [dashboard, dashboardTabs, dashboardLinks] = await Promise.all([
    import("@/features/home/server/dashboard-overview-data"),
    import("@/features/home/server/dashboard-tab-data"),
    import("@/features/home/server/dashboard-link-data"),
  ]);

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
    dashboard.getDashboardNavStats(
      input.context.user,
      input.context.sectionIds,
      input.referenceNow,
    ),
    input.tab === "overview" || input.tab === "calendar"
      ? dashboard.getDashboardOverviewData(input.userId, {
          locale: input.locale,
          user: input.context.user,
          sectionIds: input.context.sectionIds,
          calendarSemesterId: input.calendarSemesterId,
          referenceNow: input.referenceNow,
          skipLinks: input.tab === "calendar",
        })
      : Promise.resolve(null),
    input.tab === "links"
      ? dashboardLinks.getLinksTabData(input.userId)
      : Promise.resolve(null),
    input.tab === "homeworks"
      ? dashboardTabs.getHomeworksTabData(input.userId, input.locale)
      : Promise.resolve(null),
    input.tab === "subscriptions" || input.tab === "exams"
      ? dashboardTabs.getSubscriptionsTabData(input.userId, input.locale)
      : Promise.resolve(null),
    input.tab === "calendar"
      ? dashboardTabs.getCalendarSubscriptionUrl(
          input.userId,
          input.context.user.calendarFeedToken,
        )
      : Promise.resolve(null),
    input.tab === "todos" || input.tab === "overview"
      ? dashboardTabs.getTodosTabData(input.userId)
      : Promise.resolve(null),
    input.tab === "bus"
      ? dashboardTabs.getBusTabData(input.userId, input.locale)
      : Promise.resolve(null),
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
