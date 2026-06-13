import { timeSortValue } from "@/features/dashboard/lib/calendar";
import type {
  CalendarEvents,
  CalendarExamEvent,
  CalendarHomeworkEvent,
  CalendarSessionEvent,
  CalendarTodoEvent,
} from "@/features/dashboard/lib/calendar-display-types";

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
  examDetail: (exam: Exam) => string;
  homeworkDetail: (homework: Homework) => string;
  sessionDetail: (session: Session) => string;
  todoDetail: (todo: Todo) => string;
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
      meta: options.sessionDetail(session),
      sort: session.startTime ?? 2400,
      title: session.courseName,
      tone: "info",
    })),
    ...events.exams.map((exam) => ({
      key: `exam-${exam.id}`,
      href: options.examsHref,
      label: options.examLabel,
      meta: options.examDetail(exam),
      sort: exam.startTime ?? 2400,
      title: exam.courseName,
      tone: "error",
    })),
    ...events.homeworks.map((homework) => ({
      done: Boolean(homework.completed ?? homework.completion),
      key: `homework-${homework.id}`,
      href: options.homeworkHref(homework),
      label: options.homeworkLabel,
      meta: options.homeworkDetail(homework),
      sort: timeSortValue(homework.submissionDueAt),
      title: homework.title,
      tone: "warning",
    })),
    ...events.todos.map((todo) => ({
      done: Boolean(todo.completed),
      key: `todo-${todo.id}`,
      href: options.todosHref,
      label: options.todoLabel,
      meta: options.todoDetail(todo),
      sort: timeSortValue(todo.dueAt),
      title: todo.title,
      tone: "success",
    })),
  ].sort(
    (left, right) =>
      left.sort - right.sort || left.title.localeCompare(right.title),
  );
}
