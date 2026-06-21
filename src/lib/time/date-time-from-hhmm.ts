import { parseDateInput } from "@/lib/time/parse-date-input";
import { formatShanghaiDate } from "@/lib/time/shanghai-format";

export function parseRequiredDateInput(value: string): Date {
  const parsed = parseDateInput(value);
  if (!(parsed instanceof Date)) {
    throw new Error("Invalid date filter");
  }
  return parsed;
}

export function toDateTimeFromHHmm(baseDate: Date | null, hhmm: number | null) {
  if (!baseDate) return null;

  const hours = hhmm ? Math.trunc(hhmm / 100) : 0;
  const minutes = hhmm ? hhmm % 100 : 0;
  return parseRequiredDateInput(
    `${formatShanghaiDate(baseDate)}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`,
  );
}
