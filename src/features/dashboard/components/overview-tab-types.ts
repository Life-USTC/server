import type {
  DashboardDashboardCopy,
  DashboardSectionCopy,
  DashboardTodoItem,
  SignedDashboardData,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import type {
  CalendarGridDay,
  CalendarGridEvent,
} from "$lib/components/calendar/types";
import type {
  DashboardCalendarData,
  DashboardCalendarEvents,
} from "./dashboard-calendar-component-types";

export type OverviewTimelineItem = CalendarGridEvent & {
  sort: number;
};

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
          | (DashboardCalendarData & {
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
