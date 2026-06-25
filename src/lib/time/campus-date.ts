import type { ConfigType, Dayjs } from "dayjs";
import { APP_TIME_ZONE, parseDateInput } from "@/lib/time/parse-date-input";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import {
  APP_DATE_ONLY_FORMAT,
  formatShanghaiDate,
} from "@/lib/time/shanghai-format";

export const CAMPUS_WEEK_STARTS_ON = 0;

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_KEY_PATTERN = /^\d{4}-\d{2}$/;

type CampusDateValue = ConfigType | null | undefined;

function dateKeyParts(key: string) {
  if (!DATE_KEY_PATTERN.test(key)) return null;
  const [year, month, day] = key.split("-").map(Number);
  if (!year || !month || !day) return null;
  return { day, month, year };
}

function resolveCampusDate(value: CampusDateValue) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "string") {
    const parsed = parseDateInput(value);
    return parsed instanceof Date ? parsed : null;
  }
  const parsed = shanghaiDayjs(value);
  return parsed.isValid() ? parsed.toDate() : null;
}

function requireCampusDateKey(key: string): Dayjs {
  const parsed = parseCampusDateKey(key);
  if (!parsed) throw new Error(`Invalid campus date key: ${key}`);
  return parsed;
}

export function toCampusDateKey(value: CampusDateValue) {
  const date = resolveCampusDate(value);
  return date ? formatShanghaiDate(date) : null;
}

export function requireCampusDateKeyForValue(value: CampusDateValue) {
  const key = toCampusDateKey(value);
  if (!key) throw new Error("Invalid campus date value");
  return key;
}

export function parseCampusDateKey(key: string) {
  if (!DATE_KEY_PATTERN.test(key)) return null;
  const parsed = parseDateInput(key);
  if (!(parsed instanceof Date)) return null;
  if (formatShanghaiDate(parsed) !== key) return null;
  return shanghaiDayjs(parsed).startOf("day");
}

export function isCampusDateKey(
  value: string | null | undefined,
): value is string {
  return Boolean(value && parseCampusDateKey(value));
}

export function isCampusMonthKey(
  value: string | null | undefined,
): value is string {
  return Boolean(
    value && MONTH_KEY_PATTERN.test(value) && isCampusDateKey(`${value}-01`),
  );
}

export function addCampusDays(key: string, days: number) {
  return requireCampusDateKey(key)
    .add(days, "day")
    .format(APP_DATE_ONLY_FORMAT);
}

export function addCampusMonths(monthKey: string, months: number) {
  const start = requireCampusDateKey(`${monthKey}-01`);
  return start.add(months, "month").format(APP_DATE_ONLY_FORMAT).slice(0, 7);
}

export function campusWeekStartKey(
  key: string,
  weekStartsOn = CAMPUS_WEEK_STARTS_ON,
) {
  const date = requireCampusDateKey(key);
  const diff = (date.day() - weekStartsOn + 7) % 7;
  return date.subtract(diff, "day").format(APP_DATE_ONLY_FORMAT);
}

export function campusDateKeyRange(startKey: string, endKey: string) {
  const start = requireCampusDateKey(startKey);
  const end = requireCampusDateKey(endKey);
  const length = end.diff(start, "day") + 1;
  return Array.from({ length: Math.max(length, 0) }, (_, index) =>
    start.add(index, "day").format(APP_DATE_ONLY_FORMAT),
  );
}

export function campusWeekKeys(startKey: string) {
  return campusDateKeyRange(startKey, addCampusDays(startKey, 6));
}

export function campusMonthGridKeys(monthKey: string) {
  const first = `${monthKey}-01`;
  const start = campusWeekStartKey(first);
  return Array.from({ length: 6 }, (_, weekIndex) =>
    Array.from({ length: 7 }, (_, dayIndex) =>
      addCampusDays(start, weekIndex * 7 + dayIndex),
    ),
  );
}

export function campusDateKeyToLocalDate(key: string) {
  const parts = dateKeyParts(key);
  if (!parts || !isCampusDateKey(key)) return null;
  // Deliberate display-only adapter: legacy Svelte calendar components read
  // local Date fields such as getDate(), while date keys remain campus-owned.
  return new Date(parts.year, parts.month - 1, parts.day);
}

export function formatCampusDate(
  value: CampusDateValue,
  fallback: string,
  locale?: string | string[],
  options?: Intl.DateTimeFormatOptions,
) {
  const date = resolveCampusDate(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat(locale, {
    timeZone: APP_TIME_ZONE,
    ...options,
  }).format(date);
}

export function formatCampusDateTime(
  value: CampusDateValue,
  fallback: string,
  locale?: string | string[],
  options?: Intl.DateTimeFormatOptions,
) {
  const date = resolveCampusDate(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: APP_TIME_ZONE,
    ...options,
  }).format(date);
}
