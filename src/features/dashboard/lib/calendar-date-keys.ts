import type { CalendarView } from "./calendar-types";

export function parseDateKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isDateKey(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return toDateKey(parseDateKey(value)) === value;
}

export function isMonthKey(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return false;
  return isDateKey(`${value}-01`);
}

export function isCalendarView(value: string | null): value is CalendarView {
  return value === "semester" || value === "month" || value === "week";
}

export function addDays(key: string, days: number) {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

export function addMonths(monthKey: string, months: number) {
  const date = parseDateKey(`${monthKey}-01`);
  date.setMonth(date.getMonth() + months);
  return toDateKey(date).slice(0, 7);
}

export function weekStartFor(key: string) {
  const date = parseDateKey(key);
  const diff = date.getDay();
  date.setDate(date.getDate() - diff);
  return toDateKey(date);
}

export function monthWeeks(monthKey: string) {
  const first = parseDateKey(`${monthKey}-01`);
  const start = parseDateKey(weekStartFor(toDateKey(first)));
  return Array.from({ length: 6 }, (_, weekIndex) =>
    Array.from({ length: 7 }, (_, dayIndex) => {
      const day = new Date(start);
      day.setDate(start.getDate() + weekIndex * 7 + dayIndex);
      return toDateKey(day);
    }),
  );
}

export function weekDaysFor(startKey: string) {
  return Array.from({ length: 7 }, (_, index) => addDays(startKey, index));
}
