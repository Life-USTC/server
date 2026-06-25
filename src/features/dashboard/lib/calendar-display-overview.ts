import { toDateKey, weekStartFor } from "@/features/dashboard/lib/calendar";
import type { CalendarExamEvent } from "@/features/dashboard/lib/calendar-display-types";
import { formatCampusDate, toCampusDateKey } from "@/lib/time/campus-date";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";

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
  return [...calendar.allExams]
    .filter((exam) => examIsUpcoming(exam, referenceDate))
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

function examIsUpcoming(exam: CalendarExamEvent, referenceDate: Date) {
  const examDay = toCampusDateKey(exam.date);
  const referenceDay = toCampusDateKey(referenceDate);
  if (!examDay || !referenceDay) return false;
  if (examDay > referenceDay) return true;
  if (examDay < referenceDay) return false;

  const reference = shanghaiDayjs(referenceDate);
  const referenceHHmm = reference.hour() * 100 + reference.minute();

  if (exam.endTime === null || exam.endTime === undefined) {
    return exam.startTime === null || exam.startTime === undefined
      ? true
      : exam.startTime >= referenceHHmm;
  }

  return exam.endTime >= referenceHHmm;
}

export function calendarSemesterIndex(calendar: {
  activeCalendarSemesterId: number | null;
  calendarSemesterNavList: Array<{ id: number }>;
}) {
  return calendar.calendarSemesterNavList.findIndex(
    (semester) => semester.id === calendar.activeCalendarSemesterId,
  );
}
