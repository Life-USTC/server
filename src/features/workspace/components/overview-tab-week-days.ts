import {
  calendarEventParts,
  calendarEventsForDay,
  weekDaysFor,
} from "@/features/workspace/lib/calendar";
import { overviewDayLabel } from "@/features/workspace/lib/calendar-display";
import { fmtTime } from "@/features/workspace/lib/overview";
import type { WorkspaceCalendarPreviewData } from "@/features/workspace/lib/workspace-controller-helpers";
import {
  type PersonalCalendarItem,
  personalItemsForDay,
} from "@/features/young/lib/personal-calendar-client";
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
  activities: readonly PersonalCalendarItem[],
): OverviewWeekDay[] {
  return weekDaysFor(overviewWeekStart).map((dayKey) => {
    const events = calendarEventsForDay(overviewCalendar, dayKey);
    const timelineItems = [
      ...calendarTimelineItemsForDay(events),
      ...personalItemsForDay(activities, dayKey),
    ].sort((left, right) => left.sort - right.sort);
    return {
      key: dayKey,
      label: overviewDayLabel(dayKey, locale),
      sublabel: formatCampusDate(dayKey, dayKey, locale, {
        weekday: "short",
      }),
      isToday: dayKey === overviewCalendar.todayDate,
      events: timelineItems.map((item) => ({
        href: item.href,
        label: item.title,
        meta:
          item.label === item.title
            ? item.meta
            : item.sort === 2400
              ? item.label
              : `${fmtTime(item.sort)} ${item.label}`,
        detail:
          item.label === item.title
            ? item.detail
            : calendarEventParts([item.meta, item.detail]),
        tone: item.tone,
        done: item.done,
      })),
    };
  });
}
