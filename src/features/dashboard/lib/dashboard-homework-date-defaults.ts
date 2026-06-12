import {
  addShanghaiTime,
  endOfShanghaiDay,
  startOfShanghaiDay,
  toShanghaiDateTimeLocalValue,
} from "@/lib/time/shanghai-format";

export function initialCreateHomeworkDraft(now: Date = new Date()) {
  return {
    publishedAt: toShanghaiDateTimeLocalValue(startOfShanghaiDay()),
    submissionStartAt: toShanghaiDateTimeLocalValue(now),
    submissionDueAt: "",
  };
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

export function homeworkStartsNow(now: Date = new Date()) {
  return toShanghaiDateTimeLocalValue(now);
}
