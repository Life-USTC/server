import { withHomeworkItemState } from "@/features/homeworks/server/homework-item-state";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { prisma } from "@/lib/db/prisma";
import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";
import { formatShanghaiDate } from "@/lib/time/shanghai-format";
import {
  getSubscribedSectionIds,
  listSubscribedExams,
  listSubscribedHomeworks,
  listSubscribedSchedules,
} from "./subscription-read-model";

function startOfShanghaiDay(date: Date) {
  return new Date(`${formatShanghaiDate(date)}T00:00:00+08:00`);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function toDateTimeFromHHmm(baseDate: Date | null, hhmm: number | null) {
  if (!baseDate) return null;

  const hours = hhmm ? Math.trunc(hhmm / 100) : 0;
  const minutes = hhmm ? hhmm % 100 : 0;
  return new Date(
    `${formatShanghaiDate(baseDate)}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00+08:00`,
  );
}

function endOfCalendarDateWindow(windowEnd: Date) {
  return addDays(startOfShanghaiDay(windowEnd), 1);
}

function isWithinExactWindow(
  {
    start,
    end,
  }: {
    start: Date | null;
    end?: Date | null;
  },
  windowStart: Date,
  windowEnd: Date,
  includeWindowEnd: boolean,
  mode: "overlap" | "start",
) {
  if (!start) return false;

  const startTime = start.getTime();
  if (Number.isNaN(startTime)) return false;

  if (mode === "overlap" && end) {
    const endTime = end.getTime();
    if (Number.isNaN(endTime)) return false;
    return (
      endTime > windowStart.getTime() &&
      (includeWindowEnd
        ? startTime <= windowEnd.getTime()
        : startTime < windowEnd.getTime())
    );
  }

  return (
    startTime >= windowStart.getTime() &&
    (includeWindowEnd
      ? startTime <= windowEnd.getTime()
      : startTime < windowEnd.getTime())
  );
}

export async function listUserCalendarEvents(
  userId: string,
  {
    locale = DEFAULT_LOCALE,
    dateFrom,
    dateTo,
    dateFromIsDateOnly = false,
    dateToIsDateOnly = false,
    dateToInclusive = false,
    eventWindowMode = "overlap",
    sectionIds,
  }: {
    locale?: string;
    dateFrom?: Date | null;
    dateTo?: Date | null;
    dateFromIsDateOnly?: boolean;
    dateToIsDateOnly?: boolean;
    dateToInclusive?: boolean;
    eventWindowMode?: "overlap" | "start";
    sectionIds?: readonly number[];
  } = {},
) {
  const windowStart = dateFrom
    ? dateFromIsDateOnly
      ? startOfShanghaiDay(dateFrom)
      : dateFrom
    : startOfShanghaiDay(new Date());
  const windowEnd =
    dateTo && dateToIsDateOnly
      ? addDays(startOfShanghaiDay(dateTo), 1)
      : (dateTo ?? addDays(windowStart, 7));
  const includeWindowEnd = Boolean(
    dateTo && dateToInclusive && !dateToIsDateOnly,
  );
  const calendarDateStart = startOfShanghaiDay(windowStart);
  const calendarDateEnd = endOfCalendarDateWindow(windowEnd);
  const scopedSectionIds = sectionIds
    ? Array.from(sectionIds)
    : await getSubscribedSectionIds(userId);

  const [schedules, homeworks, exams] = await Promise.all([
    listSubscribedSchedules(userId, {
      locale,
      dateFrom: calendarDateStart,
      dateTo: calendarDateEnd,
      sectionIds: scopedSectionIds,
    }),
    listSubscribedHomeworks(userId, {
      locale,
      completed: false,
      dueAtFrom: windowStart,
      dueAtTo: windowEnd,
      sectionIds: scopedSectionIds,
    }),
    listSubscribedExams(userId, {
      locale,
      dateFrom: calendarDateStart,
      dateTo: calendarDateEnd,
      includeDateUnknown: false,
      sectionIds: scopedSectionIds,
    }),
  ]);
  const homeworkItems = await withHomeworkItemState(homeworks);

  const todos = await prisma.todo.findMany({
    where: {
      userId,
      completed: false,
      dueAt: {
        gte: windowStart,
        ...(includeWindowEnd ? { lte: windowEnd } : { lt: windowEnd }),
      },
    },
    select: {
      id: true,
      title: true,
      content: true,
      dueAt: true,
      priority: true,
      completed: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
  });

  const events = [
    ...schedules.map((schedule) => {
      const at = toDateTimeFromHHmm(schedule.date, schedule.startTime);
      const endsAt = toDateTimeFromHHmm(schedule.date, schedule.endTime);
      return {
        type: "schedule" as const,
        at: at ? toShanghaiIsoString(at) : null,
        filterStart: at,
        filterEnd: endsAt,
        sortKey: at?.getTime() ?? Number.MAX_SAFE_INTEGER,
        payload: schedule,
      };
    }),
    ...homeworkItems.map((homework) => ({
      type: "homework_due" as const,
      at: homework.submissionDueAt
        ? toShanghaiIsoString(homework.submissionDueAt)
        : null,
      filterStart: homework.submissionDueAt,
      filterEnd: null,
      sortKey: homework.submissionDueAt?.getTime() ?? Number.MAX_SAFE_INTEGER,
      payload: homework,
    })),
    ...exams.map((exam) => {
      const at = toDateTimeFromHHmm(exam.examDate, exam.startTime);
      const endsAt =
        exam.endTime === null
          ? null
          : toDateTimeFromHHmm(exam.examDate, exam.endTime);
      const filterEnd =
        endsAt ??
        (exam.examDate && exam.startTime === null
          ? addDays(startOfShanghaiDay(exam.examDate), 1)
          : null);
      return {
        type: "exam" as const,
        at: at ? toShanghaiIsoString(at) : null,
        filterStart: at,
        filterEnd,
        sortKey: at?.getTime() ?? Number.MAX_SAFE_INTEGER,
        payload: exam,
      };
    }),
    ...todos.map((todo) => ({
      type: "todo_due" as const,
      at: todo.dueAt ? toShanghaiIsoString(todo.dueAt) : null,
      filterStart: todo.dueAt,
      filterEnd: null,
      sortKey: todo.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER,
      payload: todo,
    })),
  ];

  return events
    .filter((event) =>
      isWithinExactWindow(
        { start: event.filterStart, end: event.filterEnd },
        windowStart,
        windowEnd,
        includeWindowEnd,
        eventWindowMode,
      ),
    )
    .sort((a, b) => a.sortKey - b.sortKey)
    .map(
      ({
        filterStart: _filterStart,
        filterEnd: _filterEnd,
        sortKey: _sortKey,
        ...event
      }) => event,
    );
}
