import { describe, expect, it, vi } from "vitest";

const { writeCommentsStageAnalyticsMock } = vi.hoisted(() => ({
  writeCommentsStageAnalyticsMock: vi.fn(),
}));

vi.mock("@/lib/metrics/analytics-engine", () => ({
  writeCommentsStageAnalytics: writeCommentsStageAnalyticsMock,
}));

vi.mock("@/lib/log/observability-clock", () => ({
  elapsedMs: vi.fn(() => 12),
  monotonicNowMs: vi.fn(() => 100),
}));

import {
  countCommentStageQuery,
  countCommentStageTransaction,
  createCommentStageCounter,
  markCommentStageCountsUnknown,
  observeCommentStage,
} from "@/features/comments/server/comment-stage-analytics";

describe("comment stage analytics", () => {
  it("writes only fixed stage metadata and explicit counters", async () => {
    const counter = createCommentStageCounter({
      dbContext: "rls",
      dbLabel: "app",
    });
    countCommentStageQuery(counter);
    countCommentStageTransaction(counter);

    await expect(
      observeCommentStage({
        counter,
        details: () => ({ loadedCount: 2 }),
        stage: "comments.descendants",
        work: async () => "ok",
      }),
    ).resolves.toBe("ok");

    expect(writeCommentsStageAnalyticsMock).toHaveBeenCalledWith({
      dbContext: "rls",
      dbLabel: "app",
      dbQueryCount: 1,
      dbTransactionCount: 1,
      durationMs: 12,
      loadedCount: 2,
      outcome: "success",
      stage: "comments.descendants",
    });
  });

  it("omits incomplete counts without changing a stage error", async () => {
    writeCommentsStageAnalyticsMock.mockReset();
    const counter = createCommentStageCounter({
      dbContext: "none",
      dbLabel: "app",
    });
    markCommentStageCountsUnknown(counter);
    const stageError = new Error("stage failed");

    await expect(
      observeCommentStage({
        counter,
        stage: "target.resolve",
        work: async () => {
          throw stageError;
        },
      }),
    ).rejects.toBe(stageError);
    expect(writeCommentsStageAnalyticsMock).not.toHaveBeenCalled();
  });

  it("ignores Analytics Engine write failures", async () => {
    writeCommentsStageAnalyticsMock.mockReset().mockImplementation(() => {
      throw new Error("analytics unavailable");
    });
    const counter = createCommentStageCounter({
      dbContext: "none",
      dbLabel: "app",
    });

    await expect(
      observeCommentStage({
        counter,
        stage: "target.payload",
        work: async () => ({ ok: true }),
      }),
    ).resolves.toEqual({ ok: true });
  });
});
