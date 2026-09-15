import { parseDateInput } from "@/lib/time/parse-date-input";
import { resolveCalendarEventWindow } from "./calendar-event-window";

export class InvalidCalendarRangeError extends Error {}

export function parsePersonalCalendarRange(input: {
  dateFrom?: string;
  dateTo?: string;
}) {
  const dateFrom = input.dateFrom ? parseDateInput(input.dateFrom) : null;
  const dateTo = input.dateTo ? parseDateInput(input.dateTo) : null;
  if (Boolean(input.dateFrom) !== Boolean(input.dateTo))
    throw new InvalidCalendarRangeError("Supply both dateFrom and dateTo");
  if ((input.dateFrom && !dateFrom) || (input.dateTo && !dateTo))
    throw new InvalidCalendarRangeError(
      "Calendar range must be valid, ordered and at most 366 days",
    );
  const range = {
    dateFrom,
    dateTo,
    dateFromIsDateOnly: /^\d{4}-\d{2}-\d{2}$/.test(input.dateFrom ?? ""),
    dateToIsDateOnly: /^\d{4}-\d{2}-\d{2}$/.test(input.dateTo ?? ""),
    dateToInclusive: true,
  };
  const { windowStart, windowEnd } = resolveCalendarEventWindow(range);
  if (
    (range.dateToIsDateOnly && windowEnd <= windowStart) ||
    windowEnd < windowStart ||
    windowEnd.getTime() - windowStart.getTime() > 366 * 86400000
  )
    throw new InvalidCalendarRangeError(
      "Calendar range must be valid, ordered and at most 366 days",
    );
  return range;
}
