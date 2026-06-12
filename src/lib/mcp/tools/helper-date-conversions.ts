import { parseDateInput } from "@/lib/time/parse-date-input";
import { formatShanghaiDate } from "@/lib/time/shanghai-format";

export function getTodayBounds(atTime?: Date) {
  const now = atTime ?? new Date();
  const todayStart = parseRequiredDateInput(formatShanghaiDate(now));
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  return { now, todayStart, tomorrowStart };
}

export function toDateTimeFromHHmm(baseDate: Date | null, hhmm: number | null) {
  if (!baseDate) return null;

  const hours = hhmm ? Math.trunc(hhmm / 100) : 0;
  const minutes = hhmm ? hhmm % 100 : 0;
  return parseRequiredDateInput(
    `${formatShanghaiDate(baseDate)}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`,
  );
}

export function parseRequiredDateInput(value: string): Date {
  const parsed = parseDateInput(value);
  if (!(parsed instanceof Date)) {
    throw new Error("Invalid date filter");
  }
  return parsed;
}
