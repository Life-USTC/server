import type { SectionCalendarEvent } from "./calendar";

type CalendarDisplayEvent = Pick<SectionCalendarEvent, "details" | "meta">;

export function calendarEventDetail(
  event: CalendarDisplayEvent,
  label: string,
  fallback = "",
) {
  return (
    event.details.find((detail) => detail.label === label)?.value ?? fallback
  );
}

export function calendarEventTime(event: CalendarDisplayEvent, fallback = "") {
  const [time] = event.meta.split(" · ");
  return time?.trim() || fallback;
}

export function calendarEventLocation(
  event: CalendarDisplayEvent,
  fallback = "",
) {
  return event.meta.split(" · ").slice(1).join(" · ").trim() || fallback;
}

/** Row spans cover adjacent lessons only. Missing week or date values stand alone. */
export function sectionLessonRows(
  events: SectionCalendarEvent[],
  weekLabel: string,
) {
  const lessons = events
    .filter((event) => event.kind === "class")
    .sort(
      (a, b) =>
        (a.dateKey ?? "9999").localeCompare(b.dateKey ?? "9999") ||
        a.sortValue - b.sortValue ||
        a.meta.localeCompare(b.meta),
    );
  const rows = lessons.map((event) => ({
    event,
    week: calendarEventDetail(event, weekLabel),
    time: calendarEventTime(event),
    weekSpan: 1,
    timeSpan: 1,
  }));
  for (let i = rows.length - 2; i >= 0; i--) {
    const row = rows[i];
    const next = rows[i + 1];
    if (!row.week || row.week !== next.week) continue;
    row.weekSpan += next.weekSpan;
    next.weekSpan = 0;
    if (
      row.event.dateKey &&
      row.event.dateKey === next.event.dateKey &&
      row.time &&
      row.time === next.time
    ) {
      row.timeSpan += next.timeSpan;
      next.timeSpan = 0;
    }
  }
  return rows;
}
