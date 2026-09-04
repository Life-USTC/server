import type {
  DashboardDashboardCopy,
  DashboardSectionCopy,
  DashboardTodoItem,
} from "@/features/workspace/lib/dashboard-controller-helpers";
import {
  formatDashboardDateTime,
  formatDashboardDueRelativeTime,
} from "@/features/workspace/lib/date-formatters";
import { referenceDate } from "@/features/workspace/lib/overview";
import { todoStatus as buildTodoStatus } from "@/features/workspace/lib/todos";
import type { OverviewSignedData } from "./overview-tab-types";

export function formatOverviewDate(
  value: Date | string | null | undefined,
  sectionCopy: DashboardSectionCopy,
  signedData: OverviewSignedData,
  locale: string,
) {
  return formatDashboardDateTime(
    value,
    sectionCopy.dateTBD,
    referenceDate(signedData.referenceNow),
    locale,
  );
}

export function formatOverviewHomeworkEta(
  value: Date | string | null | undefined,
  sectionCopy: DashboardSectionCopy,
  signedData: OverviewSignedData,
  locale: string,
) {
  return formatDashboardDueRelativeTime(
    value,
    sectionCopy.dateTBD,
    referenceDate(signedData.referenceNow),
    locale,
  );
}

export function overviewTodoStatus(
  todo: DashboardTodoItem,
  dashboardCopy: DashboardDashboardCopy,
) {
  return buildTodoStatus(todo, {
    completed: dashboardCopy.completedStatus,
    pending: dashboardCopy.pendingStatus,
  });
}
