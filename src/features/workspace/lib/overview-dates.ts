import type {
  HomeworkWithDue,
  OverviewSource,
  TodoWithDue,
} from "./overview-types";

export function dayStart(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function referenceDate(value: Date | string | null | undefined) {
  if (!value) return new Date();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export function overviewReferenceDate<
  Todo extends TodoWithDue,
  Homework extends HomeworkWithDue,
>(source: OverviewSource<Todo, Homework>) {
  return source.overview?.calendar?.referenceDate
    ? new Date(source.overview.calendar.referenceDate)
    : new Date();
}
