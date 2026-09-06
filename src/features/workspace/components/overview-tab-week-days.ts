import {
  calendarEventsForDay,
  weekDaysFor,
} from "@/features/workspace/lib/calendar";
import { overviewDayLabel } from "@/features/workspace/lib/calendar-display";
import { fmtTime } from "@/features/workspace/lib/overview";
import type { WorkspaceCalendarPreviewData } from "@/features/workspace/lib/workspace-controller-helpers";
import { formatCampusDate } from "@/lib/time/campus-date";
import type {
  OverviewCalendarTimelineItemsForDay,
  OverviewWeekDay,
} from "./overview-tab-types";

export function overviewCalendarWeekDays(
  overviewCalendar: WorkspaceCalendarPreviewData,
  overviewWeekStart: string,
  calendarTimelineItemsForDay: OverviewCalendarTimelineItemsForDay,
  locale: string,
): OverviewWeekDay[] {
  return weekDaysFor(overviewWeekStart).map((dayKey) => {
    const events = calendarEventsForDay(overviewCalendar, dayKey);
    const timelineItems = calendarTimelineItemsForDay(events);
    return {
      key: dayKey,
      label: overviewDayLabel(dayKey, locale),
      sublabel: formatCampusDate(dayKey, dayKey, locale, {
        weekday: "short",
      }),
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
