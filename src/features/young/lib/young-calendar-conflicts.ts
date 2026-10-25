import type { CalendarConflictInterval } from "@/features/calendar/lib/calendar-conflict-interval";
import type { PersonalCalendarItem } from "./personal-calendar-client";

/** Only known occupied intervals can establish a conflict. Deadlines are points. */
export function youngCalendarConflicts(
  events: readonly {
    youngId: string;
    conflictIntervals?: readonly CalendarConflictInterval[];
  }[],
  personal: readonly PersonalCalendarItem[],
): Set<string> {
  const occupied = personal.filter(
    (item) =>
      ["schedule", "exam", "young_event"].includes(item.type) &&
      item.hasTime !== false &&
      item.conflictIntervals?.length,
  );
  return new Set(
    events
      .filter((event) => {
        return (event.conflictIntervals ?? []).some((interval) =>
          occupied.some(
            (item) =>
              item.youngId !== event.youngId &&
              item.conflictIntervals?.some(
                (other) =>
                  Date.parse(interval.startAt) < Date.parse(other.endAt) &&
                  Date.parse(interval.endAt) > Date.parse(other.startAt),
              ),
          ),
        );
      })
      .map((event) => event.youngId),
  );
}
