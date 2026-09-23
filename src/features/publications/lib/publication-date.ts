import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat.js";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";
import { APP_TIME_ZONE, parseDateInput } from "@/lib/time/parse-date-input";

dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parse crawler publication timestamps while retaining the source's calendar
 * semantics. Date-only and timezone-less values are Shanghai local time;
 * explicit offsets retain their supplied instant.
 */
export function parsePublicationDateInput(value: unknown) {
  if (typeof value === "string" && DATE_ONLY_PATTERN.test(value.trim())) {
    const dateOnly = value.trim();
    if (parseDateInput(dateOnly) === undefined) return undefined;
    return dayjs.tz(dateOnly, "YYYY-MM-DD", APP_TIME_ZONE).toDate();
  }
  return parseDateInput(value);
}
