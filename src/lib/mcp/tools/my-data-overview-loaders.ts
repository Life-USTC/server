import {
  listSubscribedExams,
  listSubscribedHomeworks,
} from "@/features/home/server/subscription-read-model";
import { withHomeworkItemState } from "@/features/homeworks/server/homework-item-state";
import { prisma } from "@/lib/db/prisma";

function countWhenSubscribed(
  sectionIds: number[],
  count: () => Promise<number>,
) {
  return sectionIds.length > 0 ? count() : Promise.resolve(0);
}

export async function loadMyOverviewCounts({
  sectionIds,
  todayStart,
  tomorrowStart,
  userId,
}: {
  sectionIds: number[];
  todayStart: Date;
  tomorrowStart: Date;
  userId: string;
}) {
  const [
    pendingTodosCount,
    pendingHomeworksCount,
    todaySchedulesCount,
    upcomingExamsCount,
  ] = await Promise.all([
    prisma.todo.count({ where: { userId, completed: false } }),
    countWhenSubscribed(sectionIds, () =>
      prisma.homework.count({
        where: {
          deletedAt: null,
          sectionId: { in: sectionIds },
          homeworkCompletions: { none: { userId } },
        },
      }),
    ),
    countWhenSubscribed(sectionIds, () =>
      prisma.schedule.count({
        where: {
          sectionId: { in: sectionIds },
          date: { gte: todayStart, lt: tomorrowStart },
        },
      }),
    ),
    countWhenSubscribed(sectionIds, () =>
      prisma.exam.count({
        where: {
          sectionId: { in: sectionIds },
          examDate: { gte: todayStart },
        },
      }),
    ),
  ]);

  return {
    pendingTodosCount,
    pendingHomeworksCount,
    todaySchedulesCount,
    upcomingExamsCount,
  };
}

export async function loadMyOverviewSamples({
  locale,
  now,
  sectionIds,
  userId,
}: {
  locale: string;
  now: Date;
  sectionIds: number[];
  userId: string;
}) {
  const dueTodos = await prisma.todo.findMany({
    where: {
      userId,
      completed: false,
      dueAt: { not: null },
    },
    select: {
      id: true,
      title: true,
      priority: true,
      dueAt: true,
      createdAt: true,
    },
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    take: 5,
  });
  const [dueHomeworksRaw, upcomingExams] = await Promise.all([
    listSubscribedHomeworks(userId, {
      locale,
      completed: false,
      requireDueDate: true,
      limit: 5,
      sectionIds,
    }),
    listSubscribedExams(userId, {
      locale,
      dateFrom: now,
      includeDateUnknown: false,
      limit: 5,
      sectionIds,
    }),
  ]);
  const dueHomeworks = await withHomeworkItemState(dueHomeworksRaw);

  return { dueHomeworks, dueTodos, upcomingExams };
}
