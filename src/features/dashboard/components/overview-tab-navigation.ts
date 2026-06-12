import {
  dashboardOverviewWeekStart as buildDashboardOverviewWeekStart,
  overviewUpcomingExams as buildOverviewUpcomingExams,
} from "@/features/dashboard/lib/calendar-display";
import { referenceDate } from "@/features/dashboard/lib/overview";
import type {
  DashboardCalendarData,
  DashboardCalendarSession,
  DashboardCalendarTabHref,
} from "./dashboard-calendar-component-types";
import type { OverviewSignedData } from "./overview-tab-types";

export function dashboardOverviewWeekStart(signedData: OverviewSignedData) {
  return buildDashboardOverviewWeekStart(
    signedData.overviewWeek,
    signedData.overview?.calendar?.referenceDate,
  );
}

export function overviewUpcomingExams(
  overviewCalendar: DashboardCalendarData,
  signedData: OverviewSignedData,
) {
  return buildOverviewUpcomingExams(
    overviewCalendar,
    referenceDate(signedData.referenceNow),
  );
}

export function overviewSessionHref(
  session: Pick<DashboardCalendarSession, "sectionJwId">,
  dashboardTabHref: DashboardCalendarTabHref,
) {
  return session.sectionJwId
    ? `/sections/${session.sectionJwId}`
    : dashboardTabHref("calendar");
}
