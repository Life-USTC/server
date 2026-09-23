import { calendarEventsForDay, type SectionCalendarEvent } from "./calendar";
import {
  addMonths,
  calendarMonthDays,
  calendarWeeks,
  dateKey,
  formatDate,
  formatDateTime,
  formatMonth,
  isSameMonth,
} from "./date-display";

export function createSectionDetailCalendarDisplayActions(input: {
  getNotAvailable: () => string;
  getSectionCalendarEvents: () => SectionCalendarEvent[];
  locale: string;
}) {
  function fmtDate(value: string | Date | null | undefined) {
    return formatDate(value, input.getNotAvailable(), input.locale);
  }

  function fmtDateTime(value: string | Date | null | undefined) {
    return formatDateTime(value, input.getNotAvailable(), input.locale);
  }

  function fmtMonth(value: string | Date | null | undefined) {
    return formatMonth(value, input.getNotAvailable(), input.locale);
  }

  function dateKeyValue(value: string | Date | null | undefined) {
    return dateKey(value);
  }

  return {
    addMonths,
    calendarEventsForDay(day: Date) {
      return calendarEventsForDay(
        input.getSectionCalendarEvents(),
        dateKeyValue(day),
      );
    },
    calendarMonthDays,
    calendarWeeks,
    dateKey: dateKeyValue,
    fmtDate,
    fmtDateTime,
    fmtMonth,
    isSameMonth,
  };
}
