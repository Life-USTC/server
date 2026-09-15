import { isHomeworkPendingForViewer } from "@/features/homeworks/lib/homework-completion-state";
import { dayStart, overviewReferenceDate } from "./overview-dates";
import type {
  HomeworkWithDue,
  OverviewSource,
  TodoWithDue,
} from "./overview-types";

export function pendingTodosForOverview<Todo extends TodoWithDue>(
  source: OverviewSource<Todo, HomeworkWithDue>,
) {
  return (source.todos ?? []).filter((todo) => !todo.completed);
}

export function todosDueTodayForOverview<
  Todo extends TodoWithDue,
  Homework extends HomeworkWithDue,
>(todos: Todo[], source: OverviewSource<Todo, Homework>) {
  const today = dayStart(overviewReferenceDate(source));
  return todos.filter((todo) => {
    if (!todo.dueAt) return false;
    return dayStart(new Date(todo.dueAt)).getTime() === today.getTime();
  });
}

export function todosDueSoonForOverview<
  Todo extends TodoWithDue,
  Homework extends HomeworkWithDue,
>(todos: Todo[], source: OverviewSource<Todo, Homework>) {
  const today = dayStart(overviewReferenceDate(source));
  const soon = new Date(today);
  soon.setDate(today.getDate() + 4);
  return todos.filter((todo) => {
    if (!todo.dueAt) return false;
    const due = dayStart(new Date(todo.dueAt));
    return due > today && due < soon;
  });
}

export function todosOverdueForOverview<
  Todo extends TodoWithDue,
  Homework extends HomeworkWithDue,
>(todos: Todo[], source: OverviewSource<Todo, Homework>) {
  const today = dayStart(overviewReferenceDate(source));
  return todos.filter((todo) => {
    if (!todo.dueAt) return false;
    return dayStart(new Date(todo.dueAt)) < today;
  });
}

export function homeworksOverdueForOverview<
  Todo extends TodoWithDue,
  Homework extends HomeworkWithDue,
>(source: OverviewSource<Todo, Homework>) {
  const today = dayStart(overviewReferenceDate(source));
  const reference = overviewReferenceDate(source);
  return (source.overview?.pendingHomeworks ?? []).filter((homework) => {
    if (
      !isHomeworkPendingForViewer(
        homework,
        reference instanceof Date ? reference : new Date(reference),
      )
    ) {
      return false;
    }
    if (!homework.submissionDueAt) return false;
    return dayStart(new Date(homework.submissionDueAt)) < today;
  });
}
