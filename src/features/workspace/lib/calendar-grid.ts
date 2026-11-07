import type { CalendarGridWeek } from "#lib/components/calendar/types.js";
import { calendarGridEventsForDay } from "@/features/workspace/lib/calendar-grid-events";

type CalendarSession = {
  courseName: string;
  weekIndex?: number | null;
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

type WorkspaceCalendar = {
  semesterWeeks: string[][];
  todayDate: string;
};

type WorkspaceCalendarGridOptions<
  Calendar extends WorkspaceCalendar,
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
  calendarExamChipFields: (exam: Exam) => {
    detail: string;
    meta: string;
    tooltipDetail?: string;
  };
  calendarHomeworkChipFields: (homework: Homework) => {
    detail: string;
    meta: string;
    tooltipDetail?: string;
  };
  calendarHomeworkHref: (homework: Homework) => string;
  calendarSessionChipFields: (session: Session) => {
    detail: string;
    meta: string;
    tooltipDetail?: string;
  };
  calendarTodoChipFields: (todo: Todo) => {
    detail: string;
    meta: string;
    tooltipDetail?: string;
  };
  calendarWeekLabel: (weekIndex: number) => string;
  workspaceTabHref: (tab: "exams" | "todos") => string;
  examLabel: string;
  month: string;
  monthWeeks: (month: string) => string[][];
  sectionWeekLabel: string;
  sessionHref: (session: Session) => string;
  view: string;
  weekStart: string;
};

export function buildWorkspaceCalendarGridWeeks<
  Calendar extends WorkspaceCalendar,
  Session extends CalendarSession,
  Exam extends CalendarExam,
  Homework extends CalendarHomework,
  Todo extends CalendarTodo,
>(
  options: WorkspaceCalendarGridOptions<
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

  return weeks.map((week) => {
    const days = week.map((dayKey) => ({
      dayKey,
      events: options.calendarEventsForDay(options.calendar, dayKey),
    }));
    const sessions = days.flatMap(({ events }) => events.sessions);
    const teachingWeek = sessions[0]?.weekIndex;
    const hasTeachingWeek =
      typeof teachingWeek === "number" &&
      Number.isInteger(teachingWeek) &&
      teachingWeek > 0 &&
      sessions.every((session) => session.weekIndex === teachingWeek);
    return {
      // The display formatter accepts a zero-based index; stored weeks are one-based.
      label: hasTeachingWeek
        ? options.calendarWeekLabel(teachingWeek - 1)
        : options.sectionWeekLabel,
      days: days.map(({ dayKey, events }) => ({
        key: dayKey,
        label: dayKey.slice(5),
        isToday: dayKey === options.calendar.todayDate,
        isMuted: options.view === "month" && !dayKey.startsWith(options.month),
        events: calendarGridEventsForDay(events, options),
      })),
    };
  });
}
