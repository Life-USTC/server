import { withHomeworkItemState } from "@/features/homeworks/server/homework-item-state";
import { prisma } from "@/lib/db/prisma";
import {
  getSubscribedSectionIds,
  listSubscribedExams,
  listSubscribedHomeworks,
  listSubscribedSchedules,
} from "./subscription-read-model";

export async function loadCalendarEventSources({
  calendarDateEnd,
  calendarDateStart,
  includeWindowEnd,
  locale,
  sectionIds,
  userId,
  windowEnd,
  windowStart,
}: {
  calendarDateEnd: Date;
  calendarDateStart: Date;
  includeWindowEnd: boolean;
  locale: string;
  sectionIds?: readonly number[];
  userId: string;
  windowEnd: Date;
  windowStart: Date;
}) {
  const scopedSectionIds = sectionIds
    ? Array.from(sectionIds)
    : await getSubscribedSectionIds(userId);

  const [schedules, homeworks, exams, todos] = await Promise.all([
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
    prisma.todo.findMany({
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
    }),
  ]);

  return {
    exams,
    homeworkItems: await withHomeworkItemState(homeworks),
    schedules,
    todos,
  };
}
