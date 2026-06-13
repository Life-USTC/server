import {
  calendarEventsForDay,
  parseDateKey,
  weekDaysFor,
} from "@/features/dashboard/lib/calendar";
import { overviewDayLabel } from "@/features/dashboard/lib/calendar-display";
import { fmtTime } from "@/features/dashboard/lib/overview";
import type { DashboardCalendarData } from "./dashboard-calendar-component-types";
import type {
  OverviewCalendarTimelineItemsForDay,
  OverviewWeekDay,
} from "./overview-tab-types";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function overviewCalendarWeekDays(
  overviewCalendar: DashboardCalendarData,
  overviewWeekStart: string,
  calendarTimelineItemsForDay: OverviewCalendarTimelineItemsForDay,
): OverviewWeekDay[] {
  return weekDaysFor(overviewWeekStart).map((dayKey) => {
    const events = calendarEventsForDay(overviewCalendar, dayKey);
    const timelineItems = calendarTimelineItemsForDay(events);
    return {
      key: dayKey,
      label: overviewDayLabel(dayKey),
      sublabel: WEEKDAY_LABELS[parseDateKey(dayKey).getDay()],
      isToday: dayKey === overviewCalendar.todayDate,
      events: timelineItems.map((item) => ({
        href: item.href,
        label:
          item.sort === 2400
            ? item.label
            : `${fmtTime(item.sort)} ${item.label}`,
        title: item.title,
        meta: item.meta,
        tone: item.tone,
        done: item.done,
      })),
    };
  });
}
