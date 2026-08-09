import { serializeDashboardOverview } from "@/features/dashboard/server/dashboard-overview-serialization";
import type { DashboardPageCopy } from "@/features/dashboard/server/dashboard-page-load-types";
import {
  loadSignedDashboardTabData,
  timeDashboardStage,
} from "@/features/dashboard/server/dashboard-page-tab-data";
import type { AppLocale } from "@/i18n/config";
import { withLocalizedUserDbContext } from "@/lib/db/prisma";
import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";

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
  return withLocalizedUserDbContext(input.locale, input.userId, async () => {
    const dashboard = await import(
      "@/features/dashboard/server/dashboard-overview-data"
    );
    const context = await timeDashboardStage(
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
    } = await timeDashboardStage(
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
        subscriptions?.calendarSubscriptionUrl ??
        calendarSubscriptionUrl ??
        null,
      todos,
      bus: bus?.data ?? null,
    };
  });
}
