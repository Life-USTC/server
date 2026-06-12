import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";

dayjs.extend(utc);
dayjs.extend(timezone);

export const APP_TIME_ZONE = "Asia/Shanghai";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME_WITHOUT_TZ_PATTERN =
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/;
const EXPLICIT_TIMEZONE_PATTERN = /(Z|[+-]\d{2}:\d{2})$/i;

/**
 * Parse date-like input into Date.
 * - `null`/`undefined`/empty string => `null`
 * - invalid string => `undefined`
 * - date-only strings ("YYYY-MM-DD") are interpreted as UTC midnight
 *   (preserves calendar date when stored in @db.Date columns)
 * - timezone-less datetime strings are interpreted in `APP_TIME_ZONE`
 */
export function parseDateInput(value: unknown): Date | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalized = trimmed.replace(" ", "T");
  const hasExplicitTimezone = EXPLICIT_TIMEZONE_PATTERN.test(normalized);
  const isDateOnly = DATE_ONLY_PATTERN.test(normalized);
  const isDateTimeWithoutTimezone =
    !hasExplicitTimezone && DATE_TIME_WITHOUT_TZ_PATTERN.test(normalized);

  const parsed = isDateOnly
    ? dayjs.utc(normalized)
    : isDateTimeWithoutTimezone
      ? dayjs.tz(normalized, APP_TIME_ZONE)
      : dayjs(normalized);

  return parsed.isValid() ? parsed.toDate() : undefined;
}
