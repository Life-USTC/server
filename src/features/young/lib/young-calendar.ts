import {
  type CalendarDate,
  endOfMonth,
  endOfWeek,
  fromDate,
  parseDate,
  startOfMonth,
  startOfWeek,
  Time,
  toCalendarDate,
  toCalendarDateTime,
} from "@internationalized/date";
import { APP_TIME_ZONE } from "@/lib/time/parse-date-input";
import { createShanghaiDateTimeFormatter } from "@/lib/time/shanghai-format";
import type {
  YoungEventSummary,
  YoungEventTimeBasis,
} from "../server/young-event-service";

export type YoungCalendarView = "day" | "week" | "month";

export type YoungCalendarRange = {
  start: string;
  end: string;
};

export type YoungCalendarDay = {
  key: string;
  date: Date;
  events: YoungEventSummary[];
  startingEvents: YoungEventSummary[];
  isToday: boolean;
  isMuted?: boolean;
};

export type YoungCalendarWeek = {
  days: YoungCalendarDay[];
};

function eventTimes(event: YoungEventSummary, timeBasis: YoungEventTimeBasis) {
  return timeBasis === "registration"
    ? { startAt: event.applyStartAt, endAt: event.applyEndAt }
    : { startAt: event.startAt, endAt: event.endAt };
}

function calendarDate(value: string | null | undefined): CalendarDate {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    try {
      return parseDate(value);
    } catch {
      // Invalid deep links use the same Shanghai today as a missing date.
    }
  }
  return toCalendarDate(fromDate(new Date(), APP_TIME_ZONE));
}

export function normalizeYoungCalendarDate(value: string | null | undefined) {
  return calendarDate(value).toString();
}

export function youngCalendarRange(
  view: YoungCalendarView,
  anchorDate: string,
): YoungCalendarRange {
  const anchor = calendarDate(anchorDate);
  if (view === "day") {
    return { start: anchor.toString(), end: anchor.toString() };
  }
  if (view === "week") {
    return {
      start: startOfWeek(anchor, "en-US", "sun").toString(),
      end: endOfWeek(anchor, "en-US", "sun").toString(),
    };
  }
  return {
    start: startOfWeek(startOfMonth(anchor), "en-US", "sun").toString(),
    end: endOfWeek(endOfMonth(anchor), "en-US", "sun").toString(),
  };
}

export function youngCalendarDays(
  view: YoungCalendarView,
  range: YoungCalendarRange,
  events: YoungEventSummary[],
  today = new Date(),
  timeBasis: YoungEventTimeBasis = "activity",
  monthAnchor = range.start,
): YoungCalendarDay[] {
  const selected = calendarDate(range.start);
  const end = calendarDate(range.end);
  const todayKey = toCalendarDate(fromDate(today, APP_TIME_ZONE)).toString();
  const calendarMonth = calendarDate(monthAnchor).month;
  // Parse and order each activity once. Day membership uses numeric boundaries,
  // while the original timestamp text retains the public list's tie ordering.
  const timedEvents = events
    .map((event) => {
      const times = eventTimes(event, timeBasis);
      return {
        event,
        start: times.startAt ? new Date(times.startAt).getTime() : NaN,
        end: times.endAt ? new Date(times.endAt).getTime() : null,
        startText: times.startAt ?? "",
      };
    })
    .sort(
      (left, right) =>
        left.startText.localeCompare(right.startText) ||
        left.event.youngId.localeCompare(right.event.youngId),
    );
  const days: YoungCalendarDay[] = [];
  for (let current = selected; current.compare(end) <= 0; ) {
    const key = current.toString();
    const date = current.toDate(APP_TIME_ZONE);
    const dayStart = date.getTime();
    const next = current.add({ days: 1 });
    const dayEnd = toCalendarDateTime(current, new Time(23, 59, 59, 999))
      .toDate(APP_TIME_ZONE)
      .getTime();
    const startingEvents: YoungEventSummary[] = [];
    const ongoingEvents: YoungEventSummary[] = [];
    for (const item of timedEvents) {
      const startsToday = item.start >= dayStart && item.start <= dayEnd;
      const overlaps =
        item.end == null
          ? startsToday
          : item.start <= dayEnd &&
            (item.end > dayStart ||
              (item.start === item.end && item.start === dayStart));
      if (overlaps) {
        (startsToday ? startingEvents : ongoingEvents).push(item.event);
      }
    }
    days.push({
      key,
      date,
      events: [...startingEvents, ...ongoingEvents],
      startingEvents,
      isToday: key === todayKey,
      isMuted: view === "month" && current.month !== calendarMonth,
    });
    // CalendarDate constrains arithmetic at its supported year boundary.
    if (next.compare(current) <= 0) break;
    current = next;
  }
  return days;
}

export function youngCalendarWeeks(
  days: YoungCalendarDay[],
): YoungCalendarWeek[] {
  const weeks: YoungCalendarWeek[] = [];
  for (let index = 0; index < days.length; index += 7) {
    weeks.push({ days: days.slice(index, index + 7) });
  }
  return weeks;
}

export function youngCalendarPreviousDate(
  view: YoungCalendarView,
  anchorDate: string,
) {
  const anchor = calendarDate(anchorDate);
  return anchor
    .subtract(
      view === "month" ? { months: 1 } : { days: view === "week" ? 7 : 1 },
    )
    .toString();
}

export function youngCalendarNextDate(
  view: YoungCalendarView,
  anchorDate: string,
) {
  const anchor = calendarDate(anchorDate);
  return anchor
    .add(view === "month" ? { months: 1 } : { days: view === "week" ? 7 : 1 })
    .toString();
}

/** Match the visible date range, rather than always naming a single day. */
export function youngCalendarHeading(
  view: YoungCalendarView,
  anchorDate: string,
  locale: string,
) {
  const date = (key: string) => new Date(`${key}T00:00:00+08:00`);
  if (view === "week") {
    const range = youngCalendarRange(view, anchorDate);
    return createShanghaiDateTimeFormatter(locale, {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "short",
      day: "numeric",
    }).formatRange(date(range.start), date(range.end));
  }
  return createShanghaiDateTimeFormatter(
    locale,
    view === "month"
      ? { timeZone: "Asia/Shanghai", year: "numeric", month: "long" }
      : { timeZone: "Asia/Shanghai", dateStyle: "full" },
  ).format(date(anchorDate));
}

/** Mobile agendas omit month-grid padding and start at the selected day. */
export function youngCalendarAgenda(
  days: YoungCalendarDay[],
  anchorDate: string,
) {
  const visible = days.filter((day) => !day.isMuted);
  return {
    earlier: visible.filter((day) => day.key < anchorDate),
    current: visible.filter((day) => day.key >= anchorDate),
  };
}
