import { countIncompleteTodos } from "@/features/todos/server/todo-service";
import { withUserDbContext } from "@/lib/db/prisma";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import {
  dashboardNavUserSummary,
  emptyDashboardNavStats,
} from "./dashboard-nav-stats-helpers";
import type { DashboardSemester } from "./dashboard-overview-types";
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
): Promise<DashboardNavStats> {
  const referenceNow = referenceDate
    ? shanghaiDayjs(referenceDate)
    : shanghaiDayjs();
  const activeSubscribedSections = subscribedSections.filter(
    (section) => section.retiredAt === null || section.retiredAt === undefined,
  );
  if (activeSubscribedSections.length === 0) {
    const pendingTodosCount = await (providedPendingTodosCount ??
      countIncompleteTodos(user.id));
    return emptyDashboardNavStats({ pendingTodosCount, user });
  }

  const navigationAggregatePromise = withUserDbContext(user.id, (tx) =>
    getWorkspaceNavigationAggregate(tx, user.id, referenceNow.toDate(), {
      activeSections: activeSubscribedSections,
      semesters: providedSemesters,
      skipPendingTodosCount: providedPendingTodosCount !== undefined,
    }),
  );
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
