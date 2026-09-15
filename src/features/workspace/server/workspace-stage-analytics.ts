import { elapsedMs, monotonicNowMs } from "@/lib/log/observability-clock";
import {
  type DbStageLabel,
  type WorkspaceDbStageContext,
  type WorkspaceStage,
  type WorkspaceStageCountState,
  writeWorkspaceStageAnalytics,
} from "@/lib/metrics/analytics-engine";

export type { WorkspaceStage };

export type WorkspaceStageCounter = {
  analyticsRecorded: boolean;
  countState: WorkspaceStageCountState;
  dbContext: WorkspaceDbStageContext;
  dbLabel: DbStageLabel;
  dbQueryCount: number;
  dbTransactionCount: number;
};

export function createWorkspaceStageCounter(input: {
  dbContext: WorkspaceDbStageContext;
  dbLabel: DbStageLabel;
}): WorkspaceStageCounter {
  return {
    analyticsRecorded: false,
    countState: "known",
    dbContext: input.dbContext,
    dbLabel: input.dbLabel,
    dbQueryCount: 0,
    dbTransactionCount: 0,
  };
}

export function countWorkspaceStageQuery(counter?: WorkspaceStageCounter) {
  if (!counter) return;
  counter.dbQueryCount += 1;
}

export function countWorkspaceStageTransaction(
  counter?: WorkspaceStageCounter,
) {
  if (!counter) return;
  counter.dbTransactionCount += 1;
}

/**
 * Workspace tabs delegate database work to several feature read models. Do
 * not publish a partial count as if it were exact; callers mark the counter
 * incomplete when a dependency does not expose its operation count.
 */
export function markWorkspaceStageCountsUnknown(
  counter?: WorkspaceStageCounter,
) {
  if (!counter) return;
  counter.countState = "unknown";
}

export function recordWorkspaceStageAnalytics(input: {
  counter?: WorkspaceStageCounter;
  details?: {
    loadedCount?: number;
    rootCount?: number;
    subscribedSectionCount?: number;
  };
  durationMs: number;
  outcome: "error" | "success";
  stage: WorkspaceStage;
}) {
  const counter = input.counter;
  if (!counter || counter.analyticsRecorded) return;

  // A read model may publish the precise stage result while a page
  // orchestrator also wraps the same operation for request-level timing.
  // The counter is the ownership token: only the first completion may emit
  // the datapoint, preventing duplicate nav_stats records.
  counter.analyticsRecorded = true;

  try {
    writeWorkspaceStageAnalytics({
      countState: counter.countState,
      dbContext: counter.dbContext,
      dbLabel: counter.dbLabel,
      dbQueryCount: counter.dbQueryCount,
      dbTransactionCount: counter.dbTransactionCount,
      durationMs: input.durationMs,
      outcome: input.outcome,
      stage: input.stage,
      ...input.details,
    });
  } catch {
    // Analytics is diagnostic only. Never replace the stage result/error.
  }
}

export async function observeWorkspaceStage<T>(input: {
  counter?: WorkspaceStageCounter;
  details?: (result: T | undefined) => {
    loadedCount?: number;
    rootCount?: number;
    subscribedSectionCount?: number;
  };
  stage: WorkspaceStage;
  work: () => Promise<T>;
}): Promise<T> {
  const startMs = monotonicNowMs();
  let outcome: "error" | "success" = "error";
  let result: T | undefined;

  try {
    result = await input.work();
    outcome = "success";
    return result;
  } finally {
    const counter = input.counter;
    recordWorkspaceStageAnalytics({
      counter,
      details: input.details?.(result),
      durationMs: elapsedMs(startMs),
      outcome,
      stage: input.stage,
    });
  }
}
