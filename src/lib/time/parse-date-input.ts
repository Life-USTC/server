import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat.js";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";

dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

export const APP_TIME_ZONE = "Asia/Shanghai";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME_WITHOUT_TZ_PATTERN =
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/;
const DATE_TIME_WITH_TZ_PATTERN =
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/i;
const EXPLICIT_TIMEZONE_PATTERN = /(Z|[+-]\d{2}:\d{2})$/i;
const DATE_TIME_WITHOUT_TZ_FORMATS = [
  "YYYY-MM-DDTHH:mm",
  "YYYY-MM-DDTHH:mm:ss",
  "YYYY-MM-DDTHH:mm:ss.S",
  "YYYY-MM-DDTHH:mm:ss.SS",
  "YYYY-MM-DDTHH:mm:ss.SSS",
] as const;

function isStrictDateOnly(value: string) {
  return dayjs(value, "YYYY-MM-DD", true).isValid();
}

function isStrictDateTimeWithoutTimezone(value: string) {
  return DATE_TIME_WITHOUT_TZ_FORMATS.some((format) =>
    dayjs(value, format, true).isValid(),
  );
}

function hasStrictDateTimeWithTimezone(value: string) {
  const timezoneSuffix = value.match(EXPLICIT_TIMEZONE_PATTERN)?.[0] ?? "";
  const withoutTimezone = value.slice(0, -timezoneSuffix.length);
  return isStrictDateTimeWithoutTimezone(withoutTimezone);
}

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
  const isDateTimeWithTimezone = DATE_TIME_WITH_TZ_PATTERN.test(normalized);

  if (isDateOnly && !isStrictDateOnly(normalized)) return undefined;
  if (
    isDateTimeWithoutTimezone &&
    !isStrictDateTimeWithoutTimezone(normalized)
  ) {
    return undefined;
  }
  if (isDateTimeWithTimezone && !hasStrictDateTimeWithTimezone(normalized)) {
    return undefined;
  }

  const parsed = isDateOnly
    ? dayjs.utc(normalized)
    : isDateTimeWithoutTimezone
      ? dayjs.tz(normalized, APP_TIME_ZONE)
      : dayjs(normalized);

  return parsed.isValid() ? parsed.toDate() : undefined;
}
