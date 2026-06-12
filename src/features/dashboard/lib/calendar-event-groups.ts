import type { CalendarEventSource, DateKeyed } from "./calendar-types";

export function calendarEventsForDay<
  Session extends DateKeyed,
  Exam extends DateKeyed,
  Homework extends DateKeyed,
  Todo extends DateKeyed,
>(
  calendar: CalendarEventSource<Session, Exam, Homework, Todo>,
  dayKey: string,
) {
  return {
    sessions: calendar.allSessions.filter(
      (session) => session.dateKey === dayKey,
    ),
    exams: calendar.allExams.filter((exam) => exam.dateKey === dayKey),
    homeworks: calendar.semesterHomeworks.filter(
      (homework) => homework.dateKey === dayKey,
    ),
    todos: calendar.semesterTodos.filter((todo) => todo.dateKey === dayKey),
  };
}

export function calendarEventCount(events: {
  sessions: unknown[];
  exams: unknown[];
  homeworks: unknown[];
  todos: unknown[];
}) {
  return (
    events.sessions.length +
    events.exams.length +
    events.homeworks.length +
    events.todos.length
  );
}
