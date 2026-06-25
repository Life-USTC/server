import {
  addCampusMonths,
  campusDateKeyToLocalDate,
  campusMonthGridKeys,
  formatCampusDate,
  formatCampusDateTime,
  requireCampusDateKeyForValue,
  toCampusDateKey,
} from "@/lib/time/campus-date";

export function formatDate(
  value: string | Date | null | undefined,
  fallback: string,
) {
  return formatCampusDate(value, fallback);
}

export function formatDateTime(
  value: string | Date | null | undefined,
  fallback: string,
) {
  return formatCampusDateTime(value, fallback);
}

export function formatMonth(
  value: string | Date | null | undefined,
  fallback: string,
) {
  return formatCampusDate(value, fallback, undefined, {
    month: "long",
    year: "numeric",
  });
}

export function formatTime(value: number | null | undefined, fallback: string) {
  if (value == null) return fallback;
  const padded = String(value).padStart(4, "0");
  return `${padded.slice(0, 2)}:${padded.slice(2)}`;
}

export function timeSort(value: number | null | undefined) {
  return value ?? Number.MAX_SAFE_INTEGER;
}

export function dateKey(value: string | Date | null | undefined) {
  return toCampusDateKey(value);
}

export function addMonths(value: Date, offset: number) {
  const key = dateKey(value);
  const fallbackKey = requireCampusDateKeyForValue(new Date());
  const month = addCampusMonths((key ?? fallbackKey).slice(0, 7), offset);
  return campusDateKeyToLocalDate(`${month}-01`) ?? value;
}

export function calendarMonthDays(monthStart: Date) {
  const fallbackKey = requireCampusDateKeyForValue(new Date());
  const monthKey = (dateKey(monthStart) ?? fallbackKey).slice(0, 7);
  return campusMonthGridKeys(monthKey)
    .flat()
    .map((key) => campusDateKeyToLocalDate(key))
    .filter((date): date is Date => Boolean(date));
}

export function calendarWeeks(days: Date[]) {
  return Array.from({ length: Math.ceil(days.length / 7) }, (_, index) =>
    days.slice(index * 7, index * 7 + 7),
  );
}

export function isSameMonth(day: Date, monthStart: Date) {
  return dateKey(day)?.slice(0, 7) === dateKey(monthStart)?.slice(0, 7);
}
