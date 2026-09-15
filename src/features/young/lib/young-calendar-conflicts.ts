import type { PersonalCalendarItem } from "./personal-calendar-client";

/** Only known occupied intervals can establish a conflict. Deadlines are points. */
export function youngCalendarConflicts(
  events: readonly {
    youngId: string;
    startAt: string | null;
    endAt: string | null;
  }[],
  personal: readonly PersonalCalendarItem[],
): Set<string> {
  const occupied = personal.filter(
    (item) =>
      ["schedule", "exam", "young_event"].includes(item.type) &&
      item.at &&
      item.endsAt &&
      Date.parse(item.endsAt) > Date.parse(item.at),
  );
  return new Set(
    events
      .filter((event) => {
        if (!event.startAt) return false;
        const start = Date.parse(event.startAt);
        const end = event.endAt ? Date.parse(event.endAt) : start;
        if (!Number.isFinite(start) || !Number.isFinite(end) || end < start)
          return false;
        return occupied.some(
          (item) =>
            item.youngId !== event.youngId &&
            start < Date.parse(item.endsAt as string) &&
            (end === start
              ? start >= Date.parse(item.at as string)
              : end > Date.parse(item.at as string)),
        );
      })
      .map((event) => event.youngId),
  );
}
