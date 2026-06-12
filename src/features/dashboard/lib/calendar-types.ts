export type CalendarView = "semester" | "month" | "week";

export type DateKeyed = {
  dateKey?: string | null;
};

export type CalendarEventSource<
  Session extends DateKeyed,
  Exam extends DateKeyed,
  Homework extends DateKeyed,
  Todo extends DateKeyed,
> = {
  allSessions: Session[];
  allExams: Exam[];
  semesterHomeworks: Homework[];
  semesterTodos: Todo[];
};
