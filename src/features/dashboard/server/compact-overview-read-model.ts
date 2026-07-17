import { withHomeworkItemState } from "@/features/homeworks/server/homework-item-state";
import {
  countUpcomingSubscribedExams,
  getActiveSubscribedSectionIds,
  listSubscribedHomeworks,
  listSubscribedSchedules,
  listUpcomingSubscribedExams,
} from "@/features/subscriptions/server/subscription-read-model";
import {
  countDueTodos,
  listDueTodoSamples,
  listTodoSummary,
} from "@/features/todos/server/todo-service";
import { type AppLocale, DEFAULT_LOCALE } from "@/i18n/config";
import { prisma } from "@/lib/db/prisma";
import { parseDateInput } from "@/lib/time/parse-date-input";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import { formatShanghaiDate } from "@/lib/time/shanghai-format";
import { serializeScheduleTimeFields } from "@/shared/lib/schedule-serialization";

const DEFAULT_OVERVIEW_LIMIT = 3;
const DEFAULT_HOMEWORK_WINDOW_DAYS = 7;

function requiredDate(value: Date | null | undefined, label: string) {
  if (value instanceof Date) return value;
  throw new Error(`Failed to derive ${label}`);
}

function shanghaiDateOnlyStart(input: Date) {
  return requiredDate(parseDateInput(formatShanghaiDate(input)), "day start");
}

export async function getCompactOverview(
  userId: string,
  {
    atTime = new Date(),
    homeworkWindowDays = DEFAULT_HOMEWORK_WINDOW_DAYS,
    limit = DEFAULT_OVERVIEW_LIMIT,
    locale = DEFAULT_LOCALE,
  }: {
    atTime?: Date;
    homeworkWindowDays?: number;
    limit?: number;
    locale?: AppLocale;
  } = {},
) {
  const now = atTime;
  const todayStart = shanghaiDateOnlyStart(now);
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const homeworkWindowEnd = shanghaiDayjs(now)
    .add(homeworkWindowDays, "day")
    .toDate();

  const [user, sectionIds, todos, dueTodosCount, dueTodos] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, image: true, isAdmin: true, name: true },
    }),
    getActiveSubscribedSectionIds(userId),
    listTodoSummary({
      filters: { completed: false },
      now,
      take: limit,
      userId,
    }),
    countDueTodos({
      completed: false,
      dueAtFrom: now,
      dueAtTo: homeworkWindowEnd,
      includeDueAtTo: true,
      userId,
    }),
    listDueTodoSamples({
      completed: false,
      dueAtFrom: now,
      dueAtTo: homeworkWindowEnd,
      includeDueAtTo: true,
      take: limit,
      userId,
    }),
  ]);

  const [
    pendingHomeworksCount,
    todaySchedulesCount,
    upcomingExamsCount,
    dueSoonHomeworksCount,
    schedules,
    dueSoonHomeworksRaw,
    upcomingExams,
  ] =
    sectionIds.length > 0
      ? await Promise.all([
          prisma.homework.count({
            where: {
              deletedAt: null,
              homeworkCompletions: { none: { userId } },
              sectionId: { in: sectionIds },
            },
          }),
          prisma.schedule.count({
            where: {
              date: { gte: todayStart, lt: tomorrowStart },
              sectionId: { in: sectionIds },
            },
          }),
          countUpcomingSubscribedExams({
            atTime: now,
            sectionIds,
          }),
          prisma.homework.count({
            where: {
              deletedAt: null,
              homeworkCompletions: { none: { userId } },
              sectionId: { in: sectionIds },
              submissionDueAt: { gte: now, lte: homeworkWindowEnd },
            },
          }),
          listSubscribedSchedules(userId, {
            dateFrom: todayStart,
            dateTo: todayStart,
            limit,
            locale,
            sectionIds,
          }),
          listSubscribedHomeworks(userId, {
            completed: false,
            dueAtFrom: now,
            dueAtTo: homeworkWindowEnd,
            includeEditors: true,
            limit,
            locale,
            requireDueDate: true,
            sectionIds,
          }),
          listUpcomingSubscribedExams(userId, {
            atTime: now,
            limit,
            locale,
            sectionIds,
          }),
        ])
      : [0, 0, 0, 0, [], [], []];

  const dueSoonHomeworks = await withHomeworkItemState(dueSoonHomeworksRaw);

  return {
    user: {
      userId: user?.id ?? userId,
      name: user?.name ?? null,
      image: user?.image ?? null,
      isAdmin: user?.isAdmin ?? false,
    },
    anchor: {
      atTime: now,
      todayStart,
      tomorrowStart,
      homeworkWindowDays,
      homeworkWindowEnd,
      limit,
    },
    counts: {
      todos: todos.counts,
      pendingHomeworks: pendingHomeworksCount,
      dueSoonHomeworks: dueSoonHomeworksCount,
      todaySchedules: todaySchedulesCount,
      upcomingExams: upcomingExamsCount,
    },
    schedules: {
      total: todaySchedulesCount,
      items: schedules.map(serializeScheduleTimeFields),
    },
    todos: {
      counts: todos.counts,
      items: todos.todos,
    },
    dueTodos: {
      total: dueTodosCount,
      items: dueTodos,
    },
    homeworks: {
      total: dueSoonHomeworksCount,
      items: dueSoonHomeworks,
    },
    exams: {
      total: upcomingExamsCount,
      items: upcomingExams,
    },
  };
}
