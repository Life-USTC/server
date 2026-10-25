import {
  type CalendarConflictInterval,
  calendarConflictInterval,
} from "@/features/calendar/lib/calendar-conflict-interval";
import { isRecord } from "@/lib/is-record";

/** Overall activity windows describe availability, not necessarily attendance. */
export function youngEventConflictIntervals(event: {
  startAt: string | null;
  endAt: string | null;
  categoryCode: string | null;
  formCode: string | null;
  places: unknown;
}): CalendarConflictInterval[] {
  const envelope = calendarConflictInterval(event.startAt, event.endAt);
  if (!envelope) return [];
  const timedPlaces = Array.isArray(event.places)
    ? event.places.filter(
        (place) =>
          isRecord(place) && (place.placeSt != null || place.placeEt != null),
      )
    : [];
  if (timedPlaces.length) {
    return timedPlaces.flatMap((place) => {
      const interval = calendarConflictInterval(
        typeof place.placeSt === "string" ? place.placeSt : null,
        typeof place.placeEt === "string" ? place.placeEt : null,
      );
      // Contradictory slots are not known occupancy. Containment also keeps
      // the calendar's display-window query sufficient for conflict reads.
      return interval &&
        interval.startAt >= envelope.startAt &&
        interval.endAt <= envelope.endAt
        ? [interval]
        : [];
    });
  }
  // Source codes: single project / on-site participation. Even these codes
  // occur on multi-day availability windows, so only a same-day range is known.
  return event.categoryCode === "0" &&
    event.formCode === "0" &&
    envelope.startAt.slice(0, 10) === envelope.endAt.slice(0, 10)
    ? [envelope]
    : [];
}
