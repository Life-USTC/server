export type CalendarSessionEvent = {
  id: string | number;
  courseName: string;
  endTime?: number | null;
  location?: string | null;
  startTime?: number | null;
  teacherDisplay?: string | null;
};

export type CalendarExamEvent = {
  id: string | number;
  courseName: string;
  date?: Date | string | null;
  endTime?: number | null;
  examMode?: string | null;
  rooms?: unknown;
  startTime?: number | null;
};

export type CalendarHomeworkEvent = {
  completion?: unknown;
  completed?: boolean;
  id: string | number;
  description?: string | null;
  section?: { jwId?: number | string | null } | null;
  submissionDueAt?: Date | string | null;
  title: string;
};

export type CalendarTodoEvent = {
  completed?: boolean;
  id: string | number;
  content?: string | null;
  dueAt?: Date | string | null;
  title: string;
};

export type CalendarEvents<
  Session extends CalendarSessionEvent,
  Exam extends CalendarExamEvent,
  Homework extends CalendarHomeworkEvent,
  Todo extends CalendarTodoEvent,
> = {
  sessions: Session[];
  exams: Exam[];
  homeworks: Homework[];
  todos: Todo[];
};
