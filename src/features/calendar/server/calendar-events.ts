import type { SubscribedSectionContext } from "@/features/subscriptions/server/subscription-read-model";
import { listSubscribedYoungCalendarEvents } from "@/features/young/server/young-calendar-service";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";
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
    sectionContext = "full",
    atTime,
  }: {
    locale?: string;
    dateFrom?: Date | null;
    dateTo?: Date | null;
    dateFromIsDateOnly?: boolean;
    dateToIsDateOnly?: boolean;
    dateToInclusive?: boolean;
    eventWindowMode?: "overlap" | "start";
    sectionIds?: readonly number[];
    sectionContext?: SubscribedSectionContext;
    atTime?: Date;
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
  // Young events share no input with the other sources, so they load beside
  // them rather than after them.
  const [{ exams, homeworkItems, schedules, todos }, youngEvents] =
    await Promise.all([
      loadCalendarEventSources({
        calendarDateEnd,
        calendarDateStart,
        includeWindowEnd,
        locale,
        now: atTime,
        sectionIds,
        sectionContext,
        userId,
        windowEnd,
        windowStart,
      }),
      listSubscribedYoungCalendarEvents(
        userId,
        windowStart,
        windowEnd,
        includeWindowEnd,
      ),
    ]);
  const events = [
    ...youngEvents,
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
      }) => ({
        ...event,
        endsAt: _filterEnd ? toShanghaiIsoString(_filterEnd) : null,
      }),
    );
}
