import { elapsedMs, monotonicNowMs } from "@/lib/log/observability-clock";
import {
  type CommentsStage,
  type DbStageContext,
  type DbStageLabel,
  writeCommentsStageAnalytics,
} from "@/lib/metrics/analytics-engine";

export type CommentStageCounter = {
  complete: boolean;
  dbContext: DbStageContext;
  dbLabel: DbStageLabel;
  dbQueryCount: number;
  dbTransactionCount: number;
};

export function createCommentStageCounter(input: {
  dbContext: DbStageContext;
  dbLabel: DbStageLabel;
}): CommentStageCounter {
  return {
    complete: true,
    dbContext: input.dbContext,
    dbLabel: input.dbLabel,
    dbQueryCount: 0,
    dbTransactionCount: 0,
  };
}

export function countCommentStageQuery(counter?: CommentStageCounter) {
  if (!counter) return;
  counter.dbQueryCount += 1;
}

export function countCommentStageTransaction(counter?: CommentStageCounter) {
  if (!counter) return;
  counter.dbTransactionCount += 1;
}

/**
 * Mark a stage when some of its database work is owned by another layer and
 * cannot be counted truthfully here. The writer requires counts, so omitting
 * this datapoint is safer than publishing a guessed zero.
 */
export function markCommentStageCountsUnknown(counter: CommentStageCounter) {
  counter.complete = false;
}

export async function observeCommentStage<T>(input: {
  counter?: CommentStageCounter;
  details?: (result: T | undefined) => {
    loadedCount?: number;
    rootCount?: number;
  };
  stage: CommentsStage;
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
    if (counter?.complete) {
      const details = input.details?.(result);
      try {
        writeCommentsStageAnalytics({
          dbContext: counter.dbContext,
          dbLabel: counter.dbLabel,
          dbQueryCount: counter.dbQueryCount,
          dbTransactionCount: counter.dbTransactionCount,
          durationMs: elapsedMs(startMs),
          outcome,
          stage: input.stage,
          ...details,
        });
      } catch {
        // Analytics is diagnostic only. Never replace the stage result/error.
      }
    }
  }
}
