import { countIncompleteTodos } from "@/features/todos/server/todo-service";
import { withUserDbContext } from "@/lib/db/prisma";
import { getUserRlsTransactionClient } from "@/lib/db/rls-context";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import {
  dashboardNavUserSummary,
  emptyDashboardNavStats,
} from "./dashboard-nav-stats-helpers";
import type { DashboardSemester } from "./dashboard-overview-types";
import {
  countDashboardStageTransaction,
  type DashboardStageCounter,
  markDashboardStageCountsUnknown,
  observeDashboardStage,
} from "./dashboard-stage-analytics";
import type {
  DashboardSubscribedSection,
  DashboardUserSummary,
} from "./dashboard-user-context";
import { getWorkspaceNavigationAggregate } from "./workspace-navigation-summary";

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
  providedPendingTodosCount?: Promise<number>,
  providedSemesters?: readonly DashboardSemester[],
  stageCounter?: DashboardStageCounter,
): Promise<DashboardNavStats> {
  const referenceNow = referenceDate
    ? shanghaiDayjs(referenceDate)
    : shanghaiDayjs();
  const activeSubscribedSections = subscribedSections.filter(
    (section) => section.retiredAt === null || section.retiredAt === undefined,
  );
  if (activeSubscribedSections.length === 0) {
    if (!providedPendingTodosCount) {
      markDashboardStageCountsUnknown(stageCounter);
    }
    const pendingTodosCount = await (providedPendingTodosCount ??
      countIncompleteTodos(user.id));
    return emptyDashboardNavStats({ pendingTodosCount, user });
  }

  const navigationAggregatePromise = observeDashboardStage({
    counter: stageCounter,
    details: () => ({
      subscribedSectionCount: activeSubscribedSections.length,
    }),
    stage: "nav_stats",
    work: () => {
      if (stageCounter && !getUserRlsTransactionClient()) {
        countDashboardStageTransaction(stageCounter);
      }
      return withUserDbContext(user.id, (tx) =>
        getWorkspaceNavigationAggregate(tx, user.id, referenceNow.toDate(), {
          activeSections: activeSubscribedSections,
          semesters: providedSemesters,
          skipPendingTodosCount: providedPendingTodosCount !== undefined,
          ...(stageCounter ? { stageCounter } : {}),
        }),
      );
    },
  });
  const pendingTodosCountPromise =
    providedPendingTodosCount ??
    navigationAggregatePromise.then((aggregate) => aggregate.pendingTodosCount);
  const [navigationAggregate, pendingTodosCount] = await Promise.all([
    navigationAggregatePromise,
    pendingTodosCountPromise,
  ]);

  return {
    user: dashboardNavUserSummary(user),
    calendarItemsCount: navigationAggregate.calendarItemsCount,
    pendingHomeworksCount: navigationAggregate.pendingHomeworksCount,
    highlightPendingHomeworks: navigationAggregate.highlightPendingHomeworks,
    examsCount: navigationAggregate.examsCount,
    pendingTodosCount,
  };
}
