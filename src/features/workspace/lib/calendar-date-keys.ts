import {
  addCampusDays,
  addCampusMonths,
  campusDateKeyToLocalDate,
  campusMonthGridKeys,
  campusWeekKeys,
  campusWeekStartKey,
  isCampusDateKey,
  isCampusMonthKey,
  toCampusDateKey,
} from "@/lib/time/campus-date";
import type { CalendarView } from "./calendar-types";

export function parseDateKey(key: string) {
  // Display-only adapter for Svelte components that still read local Date fields.
  return campusDateKeyToLocalDate(key) ?? new Date(Number.NaN);
}

export function toDateKey(date: Date) {
  return toCampusDateKey(date) ?? "";
}

export function isDateKey(value: string | null | undefined): value is string {
  return isCampusDateKey(value);
}

export function isMonthKey(value: string | null | undefined): value is string {
  return isCampusMonthKey(value);
}

export function isCalendarView(value: string | null): value is CalendarView {
  return value === "semester" || value === "month" || value === "week";
}

export function addDays(key: string, days: number) {
  return addCampusDays(key, days);
}

export function addMonths(monthKey: string, months: number) {
  return addCampusMonths(monthKey, months);
}

export function weekStartFor(key: string) {
  return campusWeekStartKey(key);
}

export function monthWeeks(monthKey: string) {
  return campusMonthGridKeys(monthKey);
}

export function weekDaysFor(startKey: string) {
  return campusWeekKeys(startKey);
}
