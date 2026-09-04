import type { DashboardTimelineItem } from "@/features/workspace/lib/dashboard-agenda";
import type {
  DashboardCalendarPreviewData,
  DashboardDashboardCopy,
  DashboardSectionCopy,
  DashboardTodoItem,
  SignedDashboardData,
} from "@/features/workspace/lib/dashboard-controller-helpers";
import type { CalendarGridDay } from "$lib/components/calendar/types";
import type { DashboardCalendarEvents } from "./dashboard-calendar-component-types";

export type OverviewTimelineItem = DashboardTimelineItem;

export type OverviewCalendarTimelineItemsForDay = (
  events: DashboardCalendarEvents,
) => OverviewTimelineItem[];

export type OverviewWeekDay = CalendarGridDay;

export type OverviewSignedData = SignedDashboardData & {
  overviewWeek?: string | null;
  referenceNow?: Date | string | null;
  overview?:
    | (NonNullable<SignedDashboardData["overview"]> & {
        calendar?:
          | (DashboardCalendarPreviewData & {
              referenceDate?: string | null;
            })
          | null;
      })
    | null;
};

export type OverviewDateFormatter = (
  value: Date | string | null | undefined,
  sectionCopy: DashboardSectionCopy,
  signedData: OverviewSignedData,
  locale: string,
) => string;

export type OverviewTodoStatus = (
  todo: DashboardTodoItem,
  dashboardCopy: DashboardDashboardCopy,
) => string;
