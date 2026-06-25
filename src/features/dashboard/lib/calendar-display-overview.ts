import { toDateKey, weekStartFor } from "@/features/dashboard/lib/calendar";
import type { CalendarExamEvent } from "@/features/dashboard/lib/calendar-display-types";
import { dayStart } from "@/features/dashboard/lib/overview";
import { formatCampusDate, toCampusDateKey } from "@/lib/time/campus-date";

export function dashboardOverviewWeekStart(
  overviewWeek: string | null | undefined,
  calendarReferenceDate: Date | string | null | undefined,
) {
  return weekStartFor(
    overviewWeek ??
      (calendarReferenceDate ? toCampusDateKey(calendarReferenceDate) : null) ??
      toDateKey(new Date()),
  );
}

export function overviewDayLabel(dayKey: string) {
  return formatCampusDate(dayKey, dayKey, undefined, {
    month: "short",
    day: "numeric",
  });
}

export function overviewUpcomingExams<Exam extends CalendarExamEvent>(
  calendar: { allExams: Exam[] },
  referenceDate: Date,
) {
  const today = dayStart(referenceDate);
  return [...calendar.allExams]
    .filter((exam) => !exam.date || dayStart(new Date(exam.date)) >= today)
    .sort((left, right) => {
      const leftDate = left.date
        ? new Date(left.date).getTime()
        : Number.MAX_SAFE_INTEGER;
      const rightDate = right.date
        ? new Date(right.date).getTime()
        : Number.MAX_SAFE_INTEGER;
      if (leftDate !== rightDate) return leftDate - rightDate;
      return (left.startTime ?? 2400) - (right.startTime ?? 2400);
    });
}

export function calendarSemesterIndex(calendar: {
  activeCalendarSemesterId: number | null;
  calendarSemesterNavList: Array<{ id: number }>;
}) {
  return calendar.calendarSemesterNavList.findIndex(
    (semester) => semester.id === calendar.activeCalendarSemesterId,
  );
}
