import { parseDateInput } from "@/lib/time/parse-date-input";
import { formatShanghaiTimestamp } from "@/lib/time/shanghai-format";

export type CalendarConflictInterval = { startAt: string; endAt: string };

/** A date or a single known endpoint cannot establish occupied time. */
export function calendarConflictInterval(
  startAt: string | null,
  endAt: string | null,
): CalendarConflictInterval | null {
  if (
    !startAt ||
    !endAt ||
    !/[T ]\d{2}:\d{2}/.test(startAt) ||
    !/[T ]\d{2}:\d{2}/.test(endAt)
  )
    return null;
  const start = parseDateInput(startAt);
  const end = parseDateInput(endAt);
  if (!start || !end || end <= start) return null;
  return {
    startAt: formatShanghaiTimestamp(start),
    endAt: formatShanghaiTimestamp(end),
  };
}
