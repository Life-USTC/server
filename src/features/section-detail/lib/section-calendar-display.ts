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
