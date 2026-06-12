import { toDateTimeFromHHmm } from "@/lib/mcp/tools/_helpers";
import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";
import {
  addShanghaiTime,
  startOfShanghaiDay,
} from "@/lib/time/shanghai-format";

type CalendarDateValue = Date | null;
type CalendarTimeValue = number | string | null;

type ScheduleCalendarSource = {
  date: CalendarDateValue;
  endTime: CalendarTimeValue;
  startTime: CalendarTimeValue;
};

type HomeworkCalendarSource = {
  submissionDueAt: CalendarDateValue;
};

type ExamCalendarSource = {
  endTime: CalendarTimeValue;
  examDate: CalendarDateValue;
  startTime: CalendarTimeValue;
};

type TodoCalendarSource = {
  dueAt: CalendarDateValue;
};

export function mapScheduleCalendarEvent<
  Schedule extends ScheduleCalendarSource,
>(schedule: Schedule) {
  const at = toDateTimeFromHHmm(schedule.date, timeNumber(schedule.startTime));
  const endsAt = toDateTimeFromHHmm(
    schedule.date,
    timeNumber(schedule.endTime),
  );
  return {
    type: "schedule" as const,
    at: at ? toShanghaiIsoString(at) : null,
    filterStart: at,
    filterEnd: endsAt,
    sortKey: at?.getTime() ?? Number.MAX_SAFE_INTEGER,
    payload: schedule,
  };
}

export function mapHomeworkCalendarEvent<
  Homework extends HomeworkCalendarSource,
>(homework: Homework) {
  return {
    type: "homework_due" as const,
    at: homework.submissionDueAt
      ? toShanghaiIsoString(homework.submissionDueAt)
      : null,
    filterStart: homework.submissionDueAt,
    filterEnd: null,
    sortKey: homework.submissionDueAt?.getTime() ?? Number.MAX_SAFE_INTEGER,
    payload: homework,
  };
}

export function mapExamCalendarEvent<Exam extends ExamCalendarSource>(
  exam: Exam,
) {
  const at = toDateTimeFromHHmm(exam.examDate, timeNumber(exam.startTime));
  const endsAt =
    exam.endTime === null
      ? null
      : toDateTimeFromHHmm(exam.examDate, timeNumber(exam.endTime));
  const filterEnd =
    endsAt ??
    (exam.examDate && exam.startTime === null
      ? addShanghaiTime(startOfShanghaiDay(exam.examDate), 1, "day")
      : null);
  return {
    type: "exam" as const,
    at: at ? toShanghaiIsoString(at) : null,
    filterStart: at,
    filterEnd,
    sortKey: at?.getTime() ?? Number.MAX_SAFE_INTEGER,
    payload: exam,
  };
}

function timeNumber(value: CalendarTimeValue) {
  return typeof value === "number" ? value : Number(value ?? 0);
}

export function mapTodoCalendarEvent<Todo extends TodoCalendarSource>(
  todo: Todo,
) {
  return {
    type: "todo_due" as const,
    at: todo.dueAt ? toShanghaiIsoString(todo.dueAt) : null,
    filterStart: todo.dueAt,
    filterEnd: null,
    sortKey: todo.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER,
    payload: todo,
  };
}
