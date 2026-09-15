import { countIncompleteTodos } from "@/features/todos/server/todo-service";
import { withUserDbContext } from "@/lib/db/prisma";
import { getUserRlsTransactionClient } from "@/lib/db/rls-context";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import {
  emptyWorkspaceNavStats,
  workspaceNavUserSummary,
} from "./workspace-nav-stats-helpers";
import { getWorkspaceNavigationAggregate } from "./workspace-navigation-summary";
import type { WorkspaceSemester } from "./workspace-overview-types";
import {
  countWorkspaceStageTransaction,
  markWorkspaceStageCountsUnknown,
  observeWorkspaceStage,
  type WorkspaceStageCounter,
} from "./workspace-stage-analytics";
import type {
  WorkspaceSubscribedSection,
  WorkspaceUserSummary,
} from "./workspace-user-context";

export {
  getWorkspaceUserContext,
  type WorkspaceUserContext,
  type WorkspaceUserSummary,
} from "./workspace-user-context";

export type WorkspaceNavStats = {
  user: WorkspaceUserSummary;
  calendarItemsCount: number;
  pendingHomeworksCount: number;
  highlightPendingHomeworks: boolean;
  examsCount: number;
  pendingTodosCount: number;
};

export async function getWorkspaceNavStats(
  user: WorkspaceUserSummary,
  subscribedSections: readonly WorkspaceSubscribedSection[],
  referenceDate?: Date,
  providedPendingTodosCount?: Promise<number>,
  providedSemesters?: readonly WorkspaceSemester[],
  stageCounter?: WorkspaceStageCounter,
): Promise<WorkspaceNavStats> {
  const referenceNow = referenceDate
    ? shanghaiDayjs(referenceDate)
    : shanghaiDayjs();
  const activeSubscribedSections = subscribedSections.filter(
    (section) => section.retiredAt === null || section.retiredAt === undefined,
  );
  if (activeSubscribedSections.length === 0) {
    if (!providedPendingTodosCount) {
      markWorkspaceStageCountsUnknown(stageCounter);
    }
    const pendingTodosCount = await (providedPendingTodosCount ??
      countIncompleteTodos(user.id));
    return emptyWorkspaceNavStats({ pendingTodosCount, user });
  }

  const navigationAggregatePromise = observeWorkspaceStage({
    counter: stageCounter,
    details: () => ({
      subscribedSectionCount: activeSubscribedSections.length,
    }),
    stage: "nav_stats",
    work: () => {
      if (stageCounter && !getUserRlsTransactionClient()) {
        countWorkspaceStageTransaction(stageCounter);
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
    user: workspaceNavUserSummary(user),
    calendarItemsCount: navigationAggregate.calendarItemsCount,
    pendingHomeworksCount: navigationAggregate.pendingHomeworksCount,
    highlightPendingHomeworks: navigationAggregate.highlightPendingHomeworks,
    examsCount: navigationAggregate.examsCount,
    pendingTodosCount,
  };
}
