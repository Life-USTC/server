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

export function findCalendarBaseMonth(events: SectionCalendarEvent[]) {
  const firstDated = events.find((event) => event.date);
  const base = firstDated?.date ? new Date(firstDated.date) : new Date();
  return new Date(base.getFullYear(), base.getMonth(), 1);
}

export function calendarEventsForDay(
  events: SectionCalendarEvent[],
  dateKey: string | null,
) {
  return events.filter((event) => event.dateKey === dateKey);
}

export function isSameMonth(day: Date, monthStart: Date) {
  return (
    day.getFullYear() === monthStart.getFullYear() &&
    day.getMonth() === monthStart.getMonth()
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
      const events = calendarEventsForDay(input.events, input.dateKey(day));
      return {
        key: day.toISOString(),
        label: String(day.getDate()),
        isToday: input.dateKey(day) === input.todayKey,
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
