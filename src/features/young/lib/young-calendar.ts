import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import { formatShanghaiDate } from "@/lib/time/shanghai-format";
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

function dayKey(input: Date) {
  return formatShanghaiDate(input);
}

function dayStart(key: string) {
  return shanghaiDayjs(`${key}T00:00:00`).startOf("day");
}

function addDays(key: string, amount: number) {
  return dayKey(dayStart(key).add(amount, "day").toDate());
}

function mondayOf(key: string) {
  const date = dayStart(key);
  const offset = (date.day() + 6) % 7;
  return dayKey(date.subtract(offset, "day").toDate());
}

export function normalizeYoungCalendarDate(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return dayKey(new Date());
  }
  const parsed = shanghaiDayjs(`${value}T00:00:00`);
  return parsed.isValid() ? dayKey(parsed.toDate()) : dayKey(new Date());
}

export function youngCalendarRange(
  view: YoungCalendarView,
  anchorDate: string,
): YoungCalendarRange {
  const anchor = normalizeYoungCalendarDate(anchorDate);
  if (view === "day") return { start: anchor, end: anchor };
  if (view === "week") {
    const start = mondayOf(anchor);
    return { start, end: addDays(start, 6) };
  }

  const month = dayStart(anchor).startOf("month");
  const first = dayKey(month.toDate());
  const gridStart = mondayOf(first);
  const last = dayKey(month.endOf("month").toDate());
  const gridEnd = addDays(mondayOf(last), 6);
  return { start: gridStart, end: gridEnd };
}

export function youngCalendarDays(
  view: YoungCalendarView,
  range: YoungCalendarRange,
  events: YoungEventSummary[],
  today = new Date(),
  timeBasis: YoungEventTimeBasis = "activity",
  monthAnchor = range.start,
): YoungCalendarDay[] {
  const selected = normalizeYoungCalendarDate(range.start);
  const end = normalizeYoungCalendarDate(range.end);
  const todayKey = dayKey(today);
  const calendarMonth = dayStart(
    normalizeYoungCalendarDate(monthAnchor),
  ).month();
  const days: YoungCalendarDay[] = [];
  let key = selected;
  while (key <= end) {
    const date = dayStart(key).toDate();
    const dayEnd = dayStart(key).endOf("day").toDate().getTime();
    const dayStartMs = date.getTime();
    const dayEvents = events
      .filter((event) => {
        const times = eventTimes(event, timeBasis);
        if (!times.startAt) return false;
        const eventStart = new Date(times.startAt).getTime();
        if (!times.endAt) {
          // A known start without an end is shown only on its start day. The
          // calendar must not invent a duration for an incomplete interval.
          return eventStart >= dayStartMs && eventStart <= dayEnd;
        }
        const eventEnd = new Date(times.endAt).getTime();
        return (
          eventStart <= dayEnd &&
          (eventEnd > dayStartMs ||
            (eventStart === eventEnd && eventStart === dayStartMs))
        );
      })
      .sort(
        (left, right) =>
          (eventTimes(left, timeBasis).startAt ?? "").localeCompare(
            eventTimes(right, timeBasis).startAt ?? "",
          ) || left.youngId.localeCompare(right.youngId),
      );
    days.push({
      key,
      date,
      events: dayEvents,
      isToday: key === todayKey,
      isMuted: view === "month" && dayStart(key).month() !== calendarMonth,
    });
    key = addDays(key, 1);
  }
  return days;
}

export function youngCalendarWeeks(
  view: YoungCalendarView,
  range: YoungCalendarRange,
  events: YoungEventSummary[],
  today = new Date(),
  timeBasis: YoungEventTimeBasis = "activity",
  monthAnchor = range.start,
): YoungCalendarWeek[] {
  const days = youngCalendarDays(
    view,
    range,
    events,
    today,
    timeBasis,
    monthAnchor,
  );
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
  const anchor = normalizeYoungCalendarDate(anchorDate);
  const amount = view === "day" ? 1 : view === "week" ? 7 : 1;
  return dayKey(
    dayStart(anchor)
      .subtract(amount, view === "month" ? "month" : "day")
      .toDate(),
  );
}

export function youngCalendarNextDate(
  view: YoungCalendarView,
  anchorDate: string,
) {
  const anchor = normalizeYoungCalendarDate(anchorDate);
  const amount = view === "day" ? 1 : view === "week" ? 7 : 1;
  return dayKey(
    dayStart(anchor)
      .add(amount, view === "month" ? "month" : "day")
      .toDate(),
  );
}
