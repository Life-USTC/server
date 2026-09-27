import { startOfShanghaiDay } from "@/lib/time/shanghai-format";
import type {
  HomeworkWithDue,
  OverviewSource,
  TodoWithDue,
} from "./overview-types";

export function dayStart(value: Date) {
  return startOfShanghaiDay(value);
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
