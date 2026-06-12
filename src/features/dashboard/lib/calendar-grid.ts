import { calendarGridEventsForDay } from "@/features/dashboard/lib/calendar-grid-events";
import type { CalendarGridWeek } from "$lib/components/calendar/types";

type CalendarSession = {
  courseName: string;
};

type CalendarExam = {
  courseName: string;
};

type CalendarHomework = {
  title: string;
};

type CalendarTodo = {
  title: string;
};

type CalendarDayEvents<
  Session extends CalendarSession,
  Exam extends CalendarExam,
  Homework extends CalendarHomework,
  Todo extends CalendarTodo,
> = {
  sessions: Session[];
  exams: Exam[];
  homeworks: Homework[];
  todos: Todo[];
};

type DashboardCalendar = {
  semesterWeeks: string[][];
  todayDate: string;
};

type DashboardCalendarGridOptions<
  Calendar extends DashboardCalendar,
  Session extends CalendarSession,
  Exam extends CalendarExam,
  Homework extends CalendarHomework,
  Todo extends CalendarTodo,
> = {
  addDays: (dateKey: string, days: number) => string;
  calendar: Calendar;
  calendarEventParts: (parts: string[]) => string;
  calendarEventsForDay: (
    calendar: Calendar,
    dayKey: string,
  ) => CalendarDayEvents<Session, Exam, Homework, Todo>;
  calendarExamDetail: (exam: Exam) => string;
  calendarHomeworkDetail: (homework: Homework) => string;
  calendarHomeworkHref: (homework: Homework) => string;
  calendarSessionDetail: (session: Session) => string;
  calendarTodoDetail: (todo: Todo) => string;
  calendarWeekLabel: (weekIndex: number) => string;
  dashboardTabHref: (tab: "exams" | "todos") => string;
  examLabel: string;
  month: string;
  monthWeeks: (month: string) => string[][];
  sectionWeekLabel: string;
  sessionHref: (session: Session) => string;
  view: string;
  weekStart: string;
};

export function buildDashboardCalendarGridWeeks<
  Calendar extends DashboardCalendar,
  Session extends CalendarSession,
  Exam extends CalendarExam,
  Homework extends CalendarHomework,
  Todo extends CalendarTodo,
>(
  options: DashboardCalendarGridOptions<
    Calendar,
    Session,
    Exam,
    Homework,
    Todo
  >,
): CalendarGridWeek[] {
  const weeks =
    options.view === "week"
      ? [
          Array.from({ length: 7 }, (_, index) =>
            options.addDays(options.weekStart, index),
          ),
        ]
      : options.view === "month"
        ? options.monthWeeks(options.month)
        : options.calendar.semesterWeeks;

  return weeks.map((week, weekIndex) => ({
    label:
      options.view === "week"
        ? options.sectionWeekLabel
        : options.calendarWeekLabel(weekIndex),
    days: week.map((dayKey) => {
      const events = options.calendarEventsForDay(options.calendar, dayKey);
      return {
        key: dayKey,
        label: dayKey.slice(5),
        isToday: dayKey === options.calendar.todayDate,
        isMuted: options.view === "month" && !dayKey.startsWith(options.month),
        events: calendarGridEventsForDay(events, options),
      };
    }),
  }));
}
