import type { Dayjs } from "dayjs";
import type { DashboardNavStats } from "./dashboard-nav-stats";
import type { DashboardUserSummary } from "./dashboard-user-context";

export function dashboardNavUserSummary(user: DashboardUserSummary) {
  return { id: user.id, name: user.name, username: user.username };
}

export function emptyDashboardNavStats(input: {
  pendingTodosCount: number;
  user: DashboardUserSummary;
}): DashboardNavStats {
  return {
    user: dashboardNavUserSummary(input.user),
    calendarItemsCount: 0,
    pendingHomeworksCount: 0,
    highlightPendingHomeworks: false,
    examsCount: 0,
    pendingTodosCount: input.pendingTodosCount,
  };
}

export function upcomingDashboardExamWhere(input: {
  nowHHmm: number;
  scopedSectionIds: number[];
  todayStart: Dayjs;
  tomorrowStart: Dayjs;
}) {
  return {
    sectionId: { in: input.scopedSectionIds },
    AND: [
      {
        OR: [
          { examDate: null },
          { examDate: { gte: input.tomorrowStart.toDate() } },
          {
            AND: [
              {
                examDate: {
                  gte: input.todayStart.toDate(),
                  lt: input.tomorrowStart.toDate(),
                },
              },
              {
                OR: [
                  { endTime: null, startTime: null },
                  { endTime: { gte: input.nowHHmm } },
                  { endTime: null, startTime: { gte: input.nowHHmm } },
                ],
              },
            ],
          },
        ],
      },
      {
        OR: [
          { examDate: { not: null } },
          { startTime: { not: null } },
          { endTime: { not: null } },
          { examType: { not: null } },
          { examMode: { not: null } },
          { examTakeCount: { not: null } },
          { examBatchId: { not: null } },
          { examRooms: { some: {} } },
        ],
      },
    ],
  };
}
