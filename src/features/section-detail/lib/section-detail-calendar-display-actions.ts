import {
  buildSectionCalendarGridWeeks,
  calendarEventsForDay,
  type SectionCalendarEvent,
} from "./calendar";
import {
  addMonths,
  calendarMonthDays,
  calendarWeeks,
  dateKey,
  formatDate,
  formatDateTime,
} from "./date-display";

export function createSectionDetailCalendarDisplayActions(input: {
  getCalendarMonthWeeks: () => Date[][];
  getNotAvailable: () => string;
  getSectionCalendarEvents: () => SectionCalendarEvent[];
  getSemesterWeekLabel: (weekStart: Date) => string;
  getTodayCalendarKey: () => string | null;
  getVisibleCalendarMonth: () => Date;
}) {
  function fmtDate(value: string | Date | null | undefined) {
    return formatDate(value, input.getNotAvailable());
  }

  function fmtDateTime(value: string | Date | null | undefined) {
    return formatDateTime(value, input.getNotAvailable());
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
    isSameMonth(day: Date, month: Date) {
      return (
        day.getFullYear() === month.getFullYear() &&
        day.getMonth() === month.getMonth()
      );
    },
    sectionCalendarGridWeeks() {
      return buildSectionCalendarGridWeeks({
        dateKey: dateKeyValue,
        events: input.getSectionCalendarEvents(),
        formatDate: fmtDate,
        monthWeeks: input.getCalendarMonthWeeks(),
        semesterWeekLabel: input.getSemesterWeekLabel,
        todayKey: input.getTodayCalendarKey(),
        visibleMonth: input.getVisibleCalendarMonth(),
      });
    },
  };
}
