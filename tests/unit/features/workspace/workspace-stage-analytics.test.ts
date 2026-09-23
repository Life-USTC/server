import { describe, expect, it, vi } from "vitest";

const { writeWorkspaceStageAnalyticsMock } = vi.hoisted(() => ({
  writeWorkspaceStageAnalyticsMock: vi.fn(),
}));

vi.mock("@/lib/metrics/analytics-engine", () => ({
  writeWorkspaceStageAnalytics: writeWorkspaceStageAnalyticsMock,
}));

vi.mock("@/lib/log/observability-clock", () => ({
  elapsedMs: vi.fn(() => 9),
  monotonicNowMs: vi.fn(() => 200),
}));

import {
  countWorkspaceStageQuery,
  countWorkspaceStageTransaction,
  createWorkspaceStageCounter,
  markWorkspaceStageCountsUnknown,
  observeWorkspaceStage,
} from "@/features/workspace/server/workspace-stage-analytics";

describe("workspace stage analytics", () => {
  it("writes a bounded workspace stage from explicit counters", async () => {
    const counter = createWorkspaceStageCounter({
      dbContext: "rls",
      dbLabel: "app",
    });
    countWorkspaceStageQuery(counter);
    countWorkspaceStageTransaction(counter);

    await expect(
      observeWorkspaceStage({
        counter,
        details: () => ({ subscribedSectionCount: 3 }),
        stage: "nav_stats",
        work: async () => "ok",
      }),
    ).resolves.toBe("ok");

    expect(writeWorkspaceStageAnalyticsMock).toHaveBeenCalledWith({
      countState: "known",
      dbContext: "rls",
      dbLabel: "app",
      dbQueryCount: 1,
      dbTransactionCount: 1,
      durationMs: 9,
      outcome: "success",
      stage: "nav_stats",
      subscribedSectionCount: 3,
    });
  });

  it("publishes an explicitly unknown partial counter without numeric counts", async () => {
    writeWorkspaceStageAnalyticsMock.mockReset();
    const counter = createWorkspaceStageCounter({
      dbContext: "none",
      dbLabel: "auth",
    });
    markWorkspaceStageCountsUnknown(counter);

    await expect(
      observeWorkspaceStage({
        counter,
        stage: "tab",
        work: async () => ({ ok: true }),
      }),
    ).resolves.toEqual({ ok: true });
    expect(writeWorkspaceStageAnalyticsMock).toHaveBeenCalledWith({
      countState: "unknown",
      dbContext: "none",
      dbLabel: "auth",
      dbQueryCount: 0,
      dbTransactionCount: 0,
      durationMs: 9,
      outcome: "success",
      stage: "tab",
    });
  });

  it("keeps the workspace result when the writer throws", async () => {
    writeWorkspaceStageAnalyticsMock.mockReset().mockImplementation(() => {
      throw new Error("analytics unavailable");
    });
    const counter = createWorkspaceStageCounter({
      dbContext: "none",
      dbLabel: "auth",
    });

    await expect(
      observeWorkspaceStage({
        counter,
        stage: "recent_session",
        work: async () => ({ ok: true }),
      }),
    ).resolves.toEqual({ ok: true });
  });
});
