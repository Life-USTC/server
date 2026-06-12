import type { getNextBusDepartures } from "@/features/bus/lib/bus-service";
import type { listUserCalendarEvents } from "@/features/home/server/calendar-events";
import {
  summarizeBusDeparture,
  summarizeExamCard,
  summarizeHomeworkCard,
  summarizeScheduleCard,
  summarizeTodoCard,
} from "./event-summary-cards";

type CalendarEvent = Awaited<ReturnType<typeof listUserCalendarEvents>>[number];
type CalendarEventType = "schedule" | "homework_due" | "exam" | "todo_due";
export type SummarizableCalendarEvent = {
  at?: string | Date | null;
  payload: unknown;
  type: CalendarEventType;
};
type BusDeparture = NonNullable<
  Awaited<ReturnType<typeof getNextBusDepartures>>
>["departures"][number];

export function summarizeCalendarEvent(value: SummarizableCalendarEvent) {
  const base = {
    type: value.type,
    at: value.at,
  };
  if (value.type === "schedule") {
    return { ...base, payload: summarizeScheduleCard(value.payload) };
  }
  if (value.type === "homework_due") {
    return { ...base, payload: summarizeHomeworkCard(value.payload) };
  }
  if (value.type === "exam") {
    return { ...base, payload: summarizeExamCard(value.payload) };
  }
  return { ...base, payload: summarizeTodoCard(value.payload) };
}

function createEventTypeCounts() {
  return {
    schedule: 0,
    homework_due: 0,
    exam: 0,
    todo_due: 0,
  };
}

export function summarizeCalendarEventCollection(
  events: readonly CalendarEvent[],
  options?: {
    itemLimit?: number;
    dayLimit?: number;
  },
) {
  const itemLimit = options?.itemLimit ?? 5;
  const dayLimit = options?.dayLimit ?? 7;
  const byType = createEventTypeCounts();
  const typedEvents = events as readonly SummarizableCalendarEvent[];

  const dayMap = new Map<
    string,
    {
      date: string;
      total: number;
      byType: ReturnType<typeof createEventTypeCounts>;
    }
  >();

  for (const event of typedEvents) {
    byType[event.type] += 1;
    const dayKey =
      typeof event.at === "string" && event.at.length >= 10
        ? event.at.slice(0, 10)
        : "unknown";
    const existing = dayMap.get(dayKey);
    if (existing) {
      existing.total += 1;
      existing.byType[event.type] += 1;
      continue;
    }
    dayMap.set(dayKey, {
      date: dayKey,
      total: 1,
      byType: {
        ...createEventTypeCounts(),
        [event.type]: 1,
      },
    });
  }

  return {
    total: typedEvents.length,
    byType,
    items: typedEvents.slice(0, itemLimit).map(summarizeCalendarEvent),
    days: Array.from(dayMap.values()).slice(0, dayLimit),
  };
}

export function summarizeBusDepartureList(
  departures: readonly BusDeparture[],
  limit: number,
) {
  return departures.slice(0, limit).map(summarizeBusDeparture);
}
