import { formatCampusDate } from "@/lib/time/campus-date";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import type { CalendarGridEvent } from "$lib/components/calendar/types";
import { addDays } from "./calendar-date-keys";

export type DashboardTimelineItem = CalendarGridEvent & {
  href: string;
  key: string;
  sort: number;
  title: string;
};

export type DashboardAgendaDay = {
  dateLabel: string;
  events: DashboardTimelineItem[];
  isToday: boolean;
  key: string;
  weekdayLabel: string;
};

export type DashboardFocusItem = DashboardTimelineItem & {
  dateKey: string;
  dateLabel: string;
  status: "now" | "urgent" | "next";
  weekdayLabel: string;
};

type TimedEvent = {
  endTime?: number | null;
  id: number | string;
  startTime?: number | null;
};

export function buildDashboardAgendaDays<
  Calendar extends { todayDate: string },
  Events,
>(input: {
  calendar: Calendar;
  dayCount?: number;
  eventsForDay: (calendar: Calendar, dayKey: string) => Events;
  locale: string;
  startKey: string;
  timelineItemsForDay: (events: Events) => DashboardTimelineItem[];
}): DashboardAgendaDay[] {
  return Array.from({ length: input.dayCount ?? 7 }, (_, index) => {
    const key = addDays(input.startKey, index);
    return {
      dateLabel: formatCampusDate(key, key, input.locale, {
        day: "numeric",
        month: "short",
      }),
      events: input.timelineItemsForDay(
        input.eventsForDay(input.calendar, key),
      ),
      isToday: key === input.calendar.todayDate,
      key,
      weekdayLabel: formatCampusDate(key, key, input.locale, {
        weekday: "long",
      }),
    };
  });
}

export function dashboardReferenceTime(
  value: Date | string | null | undefined,
) {
  const reference = shanghaiDayjs(value ?? new Date());
  return reference.hour() * 100 + reference.minute();
}

export function currentDashboardTimedEventKey(
  events: { exams: TimedEvent[]; sessions: TimedEvent[] },
  currentTime: number,
) {
  const current = [
    ...events.sessions.map((event) => ({
      ...event,
      key: `session-${event.id}`,
    })),
    ...events.exams.map((event) => ({
      ...event,
      key: `exam-${event.id}`,
    })),
  ]
    .filter(
      (event) =>
        event.startTime !== null &&
        event.startTime !== undefined &&
        event.endTime !== null &&
        event.endTime !== undefined &&
        event.startTime <= currentTime &&
        event.endTime >= currentTime,
    )
    .sort(
      (left, right) => (left.startTime ?? 2400) - (right.startTime ?? 2400),
    )[0];

  return current?.key ?? null;
}

export function dashboardFocusItem(input: {
  currentEventKey?: string | null;
  currentTime: number;
  days: DashboardAgendaDay[];
  todayKey: string;
}): DashboardFocusItem | null {
  const today = input.days.find((day) => day.key === input.todayKey);
  const current = today?.events.find(
    (event) => event.key === input.currentEventKey && !event.done,
  );
  if (current && today) {
    return focusItem(current, today, "now");
  }

  const urgent = today?.events.find(
    (event) =>
      !event.done &&
      (event.key.startsWith("homework-") || event.key.startsWith("todo-")) &&
      event.sort < input.currentTime,
  );
  if (urgent && today) {
    return focusItem(urgent, today, "urgent");
  }

  for (const day of input.days) {
    if (day.key < input.todayKey) continue;
    const next = day.events.find(
      (event) =>
        !event.done &&
        (day.key > input.todayKey ||
          event.sort >= input.currentTime ||
          event.sort === 2400),
    );
    if (next) return focusItem(next, day, "next");
  }

  return null;
}

function focusItem(
  item: DashboardTimelineItem,
  day: DashboardAgendaDay,
  status: DashboardFocusItem["status"],
): DashboardFocusItem {
  return {
    ...item,
    dateKey: day.key,
    dateLabel: day.dateLabel,
    status,
    weekdayLabel: day.weekdayLabel,
  };
}
