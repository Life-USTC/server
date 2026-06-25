import { DEFAULT_LOCALE } from "@/i18n/config";
import {
  mapExamCalendarEvent,
  mapHomeworkCalendarEvent,
  mapScheduleCalendarEvent,
  mapTodoCalendarEvent,
} from "./calendar-event-mappers";
import { loadCalendarEventSources } from "./calendar-event-sources";
import {
  isWithinExactWindow,
  resolveCalendarEventWindow,
} from "./calendar-event-window";

export async function listUserCalendarEvents(
  userId: string,
  {
    locale = DEFAULT_LOCALE,
    dateFrom,
    dateTo,
    dateFromIsDateOnly = false,
    dateToIsDateOnly = false,
    dateToInclusive = false,
    eventWindowMode = "overlap",
    sectionIds,
  }: {
    locale?: string;
    dateFrom?: Date | null;
    dateTo?: Date | null;
    dateFromIsDateOnly?: boolean;
    dateToIsDateOnly?: boolean;
    dateToInclusive?: boolean;
    eventWindowMode?: "overlap" | "start";
    sectionIds?: readonly number[];
  } = {},
) {
  const {
    calendarDateEnd,
    calendarDateStart,
    includeWindowEnd,
    windowEnd,
    windowStart,
  } = resolveCalendarEventWindow({
    dateFrom,
    dateFromIsDateOnly,
    dateTo,
    dateToInclusive,
    dateToIsDateOnly,
  });
  const { exams, homeworkItems, schedules, todos } =
    await loadCalendarEventSources({
      calendarDateEnd,
      calendarDateStart,
      includeWindowEnd,
      locale,
      sectionIds,
      userId,
      windowEnd,
      windowStart,
    });

  const events = [
    ...schedules.map(mapScheduleCalendarEvent),
    ...homeworkItems.map(mapHomeworkCalendarEvent),
    ...exams.map(mapExamCalendarEvent),
    ...todos.map(mapTodoCalendarEvent),
  ];

  return events
    .filter((event) =>
      isWithinExactWindow(
        { start: event.filterStart, end: event.filterEnd },
        windowStart,
        windowEnd,
        includeWindowEnd,
        eventWindowMode,
      ),
    )
    .sort((a, b) => a.sortKey - b.sortKey)
    .map(
      ({
        filterStart: _filterStart,
        filterEnd: _filterEnd,
        sortKey: _sortKey,
        ...event
      }) => event,
    );
}
