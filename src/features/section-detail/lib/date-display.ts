import {
  addCampusMonths,
  campusDateKeyToLocalDate,
  campusMonthGridKeys,
  formatCampusDate,
  requireCampusDateKeyForValue,
  toCampusDateKey,
} from "@/lib/time/campus-date";

export {
  formatCampusDate as formatDate,
  formatCampusDateTime as formatDateTime,
  toCampusDateKey as dateKey,
} from "@/lib/time/campus-date";
export { formatTime } from "@/shared/lib/clock-time-format";

export function formatMonth(
  value: string | Date | null | undefined,
  fallback: string,
  locale?: string,
) {
  return formatCampusDate(value, fallback, locale, {
    month: "long",
    year: "numeric",
  });
}

export function timeSort(value: number | null | undefined) {
  return value ?? Number.MAX_SAFE_INTEGER;
}

export function addMonths(value: Date, offset: number) {
  const key = toCampusDateKey(value);
  const fallbackKey = requireCampusDateKeyForValue(new Date());
  const month = addCampusMonths((key ?? fallbackKey).slice(0, 7), offset);
  return campusDateKeyToLocalDate(`${month}-01`) ?? value;
}

export function calendarMonthDays(monthStart: Date) {
  const fallbackKey = requireCampusDateKeyForValue(new Date());
  const monthKey = (toCampusDateKey(monthStart) ?? fallbackKey).slice(0, 7);
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
  return (
    toCampusDateKey(day)?.slice(0, 7) ===
    toCampusDateKey(monthStart)?.slice(0, 7)
  );
}
