import { prisma as basePrisma } from "@/lib/db/prisma";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import { getDashboardCalendarItemsCount } from "./dashboard-calendar-count";
import {
  dashboardNavUserSummary,
  emptyDashboardNavStats,
  upcomingDashboardExamWhere,
} from "./dashboard-nav-stats-helpers";
import type {
  DashboardSubscribedSection,
  DashboardUserSummary,
} from "./dashboard-user-context";

export {
  type DashboardUserContext,
  type DashboardUserSummary,
  getDashboardUserContext,
} from "./dashboard-user-context";

export type DashboardNavStats = {
  user: DashboardUserSummary;
  calendarItemsCount: number;
  pendingHomeworksCount: number;
  highlightPendingHomeworks: boolean;
  examsCount: number;
  pendingTodosCount: number;
};

export async function getDashboardNavStats(
  user: DashboardUserSummary,
  subscribedSections: readonly DashboardSubscribedSection[],
  referenceDate?: Date,
): Promise<DashboardNavStats> {
  const referenceNow = referenceDate
    ? shanghaiDayjs(referenceDate)
    : shanghaiDayjs();
  const todayStart = referenceNow.startOf("day");
  const tomorrowStart = todayStart.add(1, "day");
  const nowHHmm = referenceNow.hour() * 100 + referenceNow.minute();

  const pendingTodosCountPromise = basePrisma.todo.count({
    where: { userId: user.id, completed: false },
  });

  if (subscribedSections.length === 0) {
    const pendingTodosCount = await pendingTodosCountPromise;
    return emptyDashboardNavStats({ pendingTodosCount, user });
  }

  const scopedSectionIds = subscribedSections.map((section) => section.id);
  const [
    pendingTodosCount,
    pendingHomeworksCount,
    dueTodayHomework,
    examsCount,
    calendarItemsCount,
  ] = await Promise.all([
    pendingTodosCountPromise,
    basePrisma.homework.count({
      where: {
        deletedAt: null,
        sectionId: { in: scopedSectionIds },
        homeworkCompletions: { none: { userId: user.id } },
      },
    }),
    basePrisma.homework.findFirst({
      where: {
        deletedAt: null,
        sectionId: { in: scopedSectionIds },
        submissionDueAt: {
          gte: todayStart.toDate(),
          lt: tomorrowStart.toDate(),
        },
        homeworkCompletions: { none: { userId: user.id } },
      },
      select: { id: true },
      orderBy: [{ submissionDueAt: "asc" }, { createdAt: "desc" }],
    }),
    basePrisma.exam.count({
      where: upcomingDashboardExamWhere({
        nowHHmm,
        scopedSectionIds,
        todayStart,
        tomorrowStart,
      }),
    }),
    getDashboardCalendarItemsCount(user.id, subscribedSections, referenceNow),
  ]);

  return {
    user: dashboardNavUserSummary(user),
    calendarItemsCount,
    pendingHomeworksCount,
    highlightPendingHomeworks: Boolean(dueTodayHomework),
    examsCount,
    pendingTodosCount,
  };
}
