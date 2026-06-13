import type { CalendarGridEvent } from "$lib/components/calendar/types";

type CalendarSession = {
  courseName: string;
};

type CalendarExam = {
  courseName: string;
};

type CalendarHomework = {
  completion?: unknown;
  completed?: boolean;
  title: string;
};

type CalendarTodo = {
  completed?: boolean;
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

type CalendarGridEventOptions<
  Session extends CalendarSession,
  Exam extends CalendarExam,
  Homework extends CalendarHomework,
  Todo extends CalendarTodo,
> = {
  calendarEventParts: (parts: string[]) => string;
  calendarExamDetail: (exam: Exam) => string;
  calendarHomeworkDetail: (homework: Homework) => string;
  calendarHomeworkHref: (homework: Homework) => string;
  calendarSessionDetail: (session: Session) => string;
  calendarTodoDetail: (todo: Todo) => string;
  dashboardTabHref: (tab: "exams" | "todos") => string;
  examLabel: string;
  sessionHref: (session: Session) => string;
};

export function calendarGridEventsForDay<
  Session extends CalendarSession,
  Exam extends CalendarExam,
  Homework extends CalendarHomework,
  Todo extends CalendarTodo,
>(
  events: CalendarDayEvents<Session, Exam, Homework, Todo>,
  options: CalendarGridEventOptions<Session, Exam, Homework, Todo>,
): CalendarGridEvent[] {
  return [
    ...events.sessions.map((session) => ({
      href: options.sessionHref(session),
      label: session.courseName,
      meta: options.calendarSessionDetail(session),
      tooltip: options.calendarEventParts([
        session.courseName,
        options.calendarSessionDetail(session),
      ]),
      tone: "info" as const,
    })),
    ...events.exams.map((exam) => ({
      href: options.dashboardTabHref("exams"),
      label: `${exam.courseName} · ${options.examLabel}`,
      meta: options.calendarExamDetail(exam),
      tooltip: options.calendarEventParts([
        `${exam.courseName} · ${options.examLabel}`,
        options.calendarExamDetail(exam),
      ]),
      tone: "error" as const,
    })),
    ...events.homeworks.map((homework) => ({
      done: Boolean(homework.completed ?? homework.completion),
      href: options.calendarHomeworkHref(homework),
      label: homework.title,
      meta: options.calendarHomeworkDetail(homework),
      tooltip: options.calendarEventParts([
        homework.title,
        options.calendarHomeworkDetail(homework),
      ]),
      tone: "warning" as const,
    })),
    ...events.todos.map((todo) => ({
      done: Boolean(todo.completed),
      href: options.dashboardTabHref("todos"),
      label: todo.title,
      meta: options.calendarTodoDetail(todo),
      tooltip: options.calendarEventParts([
        todo.title,
        options.calendarTodoDetail(todo),
      ]),
      tone: "success" as const,
    })),
  ];
}
