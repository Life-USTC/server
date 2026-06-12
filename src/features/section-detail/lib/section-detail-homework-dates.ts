import {
  addShanghaiTime,
  endOfShanghaiDay,
  startOfShanghaiDay,
  toShanghaiDateTimeLocalValue,
} from "@/lib/time/shanghai-format";

export function initialHomeworkDraft(now: Date = new Date()) {
  return {
    publishedAt: toShanghaiDateTimeLocalValue(startOfShanghaiDay()),
    submissionStartAt: toShanghaiDateTimeLocalValue(now),
    submissionDueAt: "",
  };
}

export function homeworkTimestampNow(now: Date = new Date()) {
  return toShanghaiDateTimeLocalValue(now);
}

export function homeworkDueInDays(days: number, now: Date = new Date()) {
  return toShanghaiDateTimeLocalValue(
    endOfShanghaiDay(addShanghaiTime(now, days, "day")),
  );
}

export function homeworkDueInMonths(months: number, now: Date = new Date()) {
  return toShanghaiDateTimeLocalValue(
    endOfShanghaiDay(addShanghaiTime(now, months, "month")),
  );
}

export function homeworkDueAtSemesterEnd(semesterEnd: string | Date) {
  return toShanghaiDateTimeLocalValue(endOfShanghaiDay(semesterEnd));
}

export function homeworkStartAtSemesterStart(semesterStart: string | Date) {
  return toShanghaiDateTimeLocalValue(startOfShanghaiDay(semesterStart));
}

export function dateTimeInputValue(value: string | Date | null | undefined) {
  return toShanghaiDateTimeLocalValue(value);
}
