import {
  dashboardOverviewWeekStart as buildDashboardOverviewWeekStart,
  overviewUpcomingExams as buildOverviewUpcomingExams,
} from "@/features/workspace/lib/calendar-display";
import type { DashboardCalendarPreviewData } from "@/features/workspace/lib/dashboard-controller-helpers";
import { referenceDate } from "@/features/workspace/lib/overview";
import type {
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
  overviewCalendar: DashboardCalendarPreviewData,
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
    ? `/catalog/sections/${session.sectionJwId}`
    : dashboardTabHref("calendar");
}
