import { elapsedMs, monotonicNowMs } from "@/lib/log/observability-clock";
import {
  type DashboardDbStageContext,
  type DashboardStage,
  type DashboardStageCountState,
  type DbStageLabel,
  writeDashboardStageAnalytics,
} from "@/lib/metrics/analytics-engine";

export type { DashboardStage };

export type DashboardStageCounter = {
  analyticsRecorded: boolean;
  countState: DashboardStageCountState;
  dbContext: DashboardDbStageContext;
  dbLabel: DbStageLabel;
  dbQueryCount: number;
  dbTransactionCount: number;
};

export function createDashboardStageCounter(input: {
  dbContext: DashboardDbStageContext;
  dbLabel: DbStageLabel;
}): DashboardStageCounter {
  return {
    analyticsRecorded: false,
    countState: "known",
    dbContext: input.dbContext,
    dbLabel: input.dbLabel,
    dbQueryCount: 0,
    dbTransactionCount: 0,
  };
}

export function countDashboardStageQuery(counter?: DashboardStageCounter) {
  if (!counter) return;
  counter.dbQueryCount += 1;
}

export function countDashboardStageTransaction(
  counter?: DashboardStageCounter,
) {
  if (!counter) return;
  counter.dbTransactionCount += 1;
}

/**
 * Dashboard tabs delegate database work to several feature read models. Do
 * not publish a partial count as if it were exact; callers mark the counter
 * incomplete when a dependency does not expose its operation count.
 */
export function markDashboardStageCountsUnknown(
  counter?: DashboardStageCounter,
) {
  if (!counter) return;
  counter.countState = "unknown";
}

export function recordDashboardStageAnalytics(input: {
  counter?: DashboardStageCounter;
  details?: {
    loadedCount?: number;
    rootCount?: number;
    subscribedSectionCount?: number;
  };
  durationMs: number;
  outcome: "error" | "success";
  stage: DashboardStage;
}) {
  const counter = input.counter;
  if (!counter || counter.analyticsRecorded) return;

  // A read model may publish the precise stage result while a page
  // orchestrator also wraps the same operation for request-level timing.
  // The counter is the ownership token: only the first completion may emit
  // the datapoint, preventing duplicate nav_stats records.
  counter.analyticsRecorded = true;

  try {
    writeDashboardStageAnalytics({
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

export async function observeDashboardStage<T>(input: {
  counter?: DashboardStageCounter;
  details?: (result: T | undefined) => {
    loadedCount?: number;
    rootCount?: number;
    subscribedSectionCount?: number;
  };
  stage: DashboardStage;
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
    recordDashboardStageAnalytics({
      counter,
      details: input.details?.(result),
      durationMs: elapsedMs(startMs),
      outcome,
      stage: input.stage,
    });
  }
}
