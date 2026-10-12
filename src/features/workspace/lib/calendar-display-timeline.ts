import { timeSortValue } from "@/features/workspace/lib/calendar";
import type {
  CalendarEvents,
  CalendarExamEvent,
  CalendarHomeworkEvent,
  CalendarSessionEvent,
  CalendarTodoEvent,
} from "@/features/workspace/lib/calendar-display-types";
import type { CalendarEventChipFields } from "./calendar-display-details";

type TimelineOptions<
  Session extends CalendarSessionEvent,
  Exam extends CalendarExamEvent,
  Homework extends CalendarHomeworkEvent,
  Todo extends CalendarTodoEvent,
> = {
  courseLabel: string;
  examLabel: string;
  homeworkLabel: string;
  todoLabel: string;
  examsHref: string;
  todosHref: string;
  sessionHref: (session: Session) => string;
  homeworkHref: (homework: Homework) => string;
  examFields: (exam: Exam) => CalendarEventChipFields;
  homeworkFields: (homework: Homework) => CalendarEventChipFields;
  sessionFields: (session: Session) => CalendarEventChipFields;
  todoFields: (todo: Todo) => CalendarEventChipFields;
};

export function buildCalendarTimelineItemsForDay<
  Session extends CalendarSessionEvent,
  Exam extends CalendarExamEvent,
  Homework extends CalendarHomeworkEvent,
  Todo extends CalendarTodoEvent,
>(
  events: CalendarEvents<Session, Exam, Homework, Todo>,
  options: TimelineOptions<Session, Exam, Homework, Todo>,
) {
  return [
    ...events.sessions.map((session) => ({
      key: `session-${session.id}`,
      href: options.sessionHref(session),
      label: options.courseLabel,
      ...options.sessionFields(session),
      sort: session.startTime ?? 2400,
      title: session.courseName,
      badge: session.badge,
      tone: "info" as const,
    })),
    ...events.exams.map((exam) => ({
      key: `exam-${exam.id}`,
      href: options.examsHref,
      label: options.examLabel,
      ...options.examFields(exam),
      sort: exam.startTime ?? 2400,
      title: exam.courseName,
      tone: "error" as const,
    })),
    ...events.homeworks.map((homework) => ({
      done:
        homework.completionRequired !== false &&
        Boolean(homework.completed ?? homework.completion),
      key: `homework-${homework.id}`,
      href: options.homeworkHref(homework),
      label: options.homeworkLabel,
      ...options.homeworkFields(homework),
      sort: timeSortValue(homework.submissionDueAt),
      title: homework.title,
      tone: "warning" as const,
    })),
    ...events.todos.map((todo) => ({
      done: Boolean(todo.completed),
      key: `todo-${todo.id}`,
      href: options.todosHref,
      label: options.todoLabel,
      ...options.todoFields(todo),
      sort: timeSortValue(todo.dueAt),
      title: todo.title,
      tone: "success" as const,
    })),
  ].sort(
    (left, right) =>
      left.sort - right.sort || left.title.localeCompare(right.title),
  );
}
