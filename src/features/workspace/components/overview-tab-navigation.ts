import {
  overviewUpcomingExams as buildOverviewUpcomingExams,
  workspaceOverviewWeekStart as buildWorkspaceOverviewWeekStart,
} from "@/features/workspace/lib/calendar-display";
import { referenceDate } from "@/features/workspace/lib/overview";
import type { WorkspaceCalendarPreviewData } from "@/features/workspace/lib/workspace-controller-helpers";
import type { OverviewSignedData } from "./overview-tab-types";
import type {
  WorkspaceCalendarSession,
  WorkspaceCalendarTabHref,
} from "./workspace-calendar-component-types";

export function workspaceOverviewWeekStart(signedData: OverviewSignedData) {
  return buildWorkspaceOverviewWeekStart(
    signedData.overviewWeek,
    signedData.overview?.calendar?.referenceDate,
  );
}

export function overviewUpcomingExams(
  overviewCalendar: WorkspaceCalendarPreviewData,
  signedData: OverviewSignedData,
) {
  return buildOverviewUpcomingExams(
    overviewCalendar,
    referenceDate(signedData.referenceNow),
  );
}

export function overviewSessionHref(
  session: Pick<WorkspaceCalendarSession, "sectionJwId">,
  workspaceTabHref: WorkspaceCalendarTabHref,
) {
  return session.sectionJwId
    ? `/catalog/sections/${session.sectionJwId}`
    : workspaceTabHref("calendar");
}
