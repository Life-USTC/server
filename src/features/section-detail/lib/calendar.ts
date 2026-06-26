import {
  campusDateKeyToLocalDate,
  requireCampusDateKeyForValue,
  toCampusDateKey,
} from "@/lib/time/campus-date";

export type SectionCalendarEvent = {
  id: string;
  kind: "class" | "exam";
  date: string | Date | null;
  dateKey: string | null;
  title: string;
  meta: string;
  badges: string[];
  details: Array<{ label: string; value: string }>;
  sortValue: number;
};

type CalendarGridEvent = {
  detail: string;
  href: string;
  label: string;
  meta: string;
  tone: "primary" | "warning";
  tooltip: string;
};

function monthIndex(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return year * 12 + month - 1;
}

export function findCalendarBaseMonth(
  events: SectionCalendarEvent[],
  fallbackDateKey?: string | null,
) {
  const firstDated = events.find((event) => event.date);
  const fallbackKey =
    toCampusDateKey(fallbackDateKey) ??
    requireCampusDateKeyForValue(new Date());
  const baseKey = toCampusDateKey(firstDated?.date) ?? fallbackKey;
  const monthKey = baseKey.slice(0, 7);
  return campusDateKeyToLocalDate(`${monthKey}-01`) ?? new Date();
}

export function calendarMonthOffsetForDateKey(
  baseMonth: Date,
  targetDateKey: string | null | undefined,
) {
  const baseMonthKey = toCampusDateKey(baseMonth)?.slice(0, 7);
  const targetMonthKey = toCampusDateKey(targetDateKey)?.slice(0, 7);
  if (!baseMonthKey || !targetMonthKey) return 0;
  return monthIndex(targetMonthKey) - monthIndex(baseMonthKey);
}

export function calendarEventsForDay(
  events: SectionCalendarEvent[],
  dateKey: string | null,
) {
  return events.filter((event) => event.dateKey === dateKey);
}

export function isSameMonth(day: Date, monthStart: Date) {
  return (
    toCampusDateKey(day)?.slice(0, 7) ===
    toCampusDateKey(monthStart)?.slice(0, 7)
  );
}

export function calendarDetail(
  label: string,
  value: string | number | null | undefined,
  notAvailable: string,
) {
  if (value === null || value === undefined) return [];
  const text = String(value).trim();
  if (!text || text === notAvailable) return [];
  return [{ label, value: text }];
}

export function buildCalendarGridEvent(input: {
  event: SectionCalendarEvent;
  formatDate: (value: string | Date | null | undefined) => string;
}) {
  return {
    href: `#${input.event.id}`,
    label: input.event.title,
    meta: [input.formatDate(input.event.date), input.event.meta]
      .filter(Boolean)
      .join(" · "),
    detail: input.event.badges.slice(0, 2).join(" · "),
    tooltip: [input.event.title, input.event.meta, ...input.event.badges]
      .filter(Boolean)
      .join(" · "),
    tone: input.event.kind === "exam" ? "warning" : "primary",
  } satisfies CalendarGridEvent;
}

export function buildSectionCalendarGridWeeks(input: {
  dateKey: (value: Date) => string | null;
  events: SectionCalendarEvent[];
  formatDate: (value: string | Date | null | undefined) => string;
  monthWeeks: Date[][];
  semesterWeekLabel: (weekStart: Date) => string;
  todayKey: string | null;
  visibleMonth: Date;
}) {
  return input.monthWeeks.map((week) => ({
    label: input.semesterWeekLabel(week[0]),
    days: week.map((day) => {
      const dayKey = input.dateKey(day);
      const events = calendarEventsForDay(input.events, dayKey);
      return {
        key: dayKey ?? day.toISOString(),
        label: String(day.getDate()),
        isToday: dayKey === input.todayKey,
        isMuted: !isSameMonth(day, input.visibleMonth),
        events: events.map((event) =>
          buildCalendarGridEvent({
            event,
            formatDate: input.formatDate,
          }),
        ),
      };
    }),
  }));
}
