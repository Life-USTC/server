import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { getBusTimetableData } from "@/features/bus/lib/bus-service";
import type { BusLocale } from "@/features/bus/lib/bus-types";
import { HomeView } from "@/features/home/components/home-view";
import { PublicHomeView } from "@/features/home/components/public-home-view";
import {
  getLinksTabData,
  getPublicDashboardLinksData,
} from "@/features/home/server/dashboard-link-data";
import {
  getDashboardNavStats,
  getDashboardOverviewData,
  getDashboardUserContext,
} from "@/features/home/server/dashboard-overview-data";
import {
  getBusTabData,
  getCalendarSubscriptionUrl,
  getHomeworksTabData,
  getSubscriptionsTabData,
  getTodosTabData,
} from "@/features/home/server/dashboard-tab-data";
import { parseDateInput } from "@/lib/time/parse-date-input";
import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";

export const dynamic = "force-dynamic";

type HomeSearchParams = {
  tab?: string;
  dayType?: string;
  calendarSemester?: string;
  snapshotAt?: string;
};

function parseSnapshotReferenceTime(value: string | undefined) {
  if (process.env.E2E_DEBUG_AUTH !== "1" || !value) return undefined;
  const parsed = parseDateInput(value);
  return parsed instanceof Date ? parsed : undefined;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");

  return {
    title: t("pages.home"),
  };
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<HomeSearchParams>;
}) {
  const session = await auth();

  if (session?.user?.id) {
    const params = await searchParams;
    const tab = params.tab ?? "overview";
    const referenceNow = parseSnapshotReferenceTime(params.snapshotAt);
    const dashboardUserContext = await getDashboardUserContext(session.user.id);
    const parsedCalendarSemester = parseInt(params.calendarSemester ?? "", 10);
    const overviewOptions =
      tab === "calendar" &&
      Number.isFinite(parsedCalendarSemester) &&
      parsedCalendarSemester > 0
        ? {
            calendarSemesterId: parsedCalendarSemester,
            skipLinks: true,
            referenceNow,
          }
        : tab === "calendar"
          ? { skipLinks: true, referenceNow }
          : { referenceNow };

    if (!dashboardUserContext) {
      return (
        <main className="page-main flex flex-col gap-5 md:gap-6">
          <p className="text-muted-foreground">User not found.</p>
        </main>
      );
    }

    const [
      navStats,
      overviewData,
      linksData,
      homeworksData,
      subscriptionsData,
      calendarSubscriptionUrl,
      todosData,
      busData,
    ] = await Promise.all([
      getDashboardNavStats(
        dashboardUserContext.user,
        dashboardUserContext.sectionIds,
        referenceNow,
      ),
      tab === "overview" || tab === "calendar"
        ? getDashboardOverviewData(session.user.id, {
            ...overviewOptions,
            user: dashboardUserContext.user,
            sectionIds: dashboardUserContext.sectionIds,
          })
        : Promise.resolve(null),
      tab === "links"
        ? getLinksTabData(session.user.id)
        : Promise.resolve(null),
      tab === "homeworks"
        ? getHomeworksTabData(session.user.id)
        : Promise.resolve(null),
      tab === "subscriptions" || tab === "exams"
        ? getSubscriptionsTabData(session.user.id)
        : Promise.resolve(null),
      tab === "calendar"
        ? getCalendarSubscriptionUrl(
            session.user.id,
            dashboardUserContext.user.calendarFeedToken,
          )
        : Promise.resolve(null),
      tab === "todos" || tab === "overview"
        ? getTodosTabData(session.user.id)
        : Promise.resolve(null),
      tab === "bus" ? getBusTabData(session.user.id) : Promise.resolve(null),
    ]);

    return (
      <HomeView
        searchParams={searchParams}
        navStats={navStats}
        referenceNow={referenceNow ? toShanghaiIsoString(referenceNow) : null}
        overviewData={overviewData}
        linksData={linksData?.dashboardLinks ?? null}
        homeworksData={homeworksData}
        subscriptionsData={subscriptionsData}
        calendarSubscriptionUrl={
          subscriptionsData?.calendarSubscriptionUrl ??
          calendarSubscriptionUrl ??
          null
        }
        todosData={todosData}
        busData={busData}
      />
    );
  }

  const params = await searchParams;
  const publicTab = params.tab;

  // Fetch bus data for public view because bus is the default public tab.
  let publicBusData = null;
  if (publicTab !== "links") {
    const locale = await getLocale();
    const busLocale: BusLocale = locale === "en-us" ? "en-us" : "zh-cn";
    publicBusData = await getBusTimetableData({
      locale: busLocale,
      userId: null,
    });
  }

  return (
    <PublicHomeView
      searchParams={searchParams}
      dashboardLinks={getPublicDashboardLinksData().dashboardLinks}
      busData={publicBusData}
    />
  );
}
