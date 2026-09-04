import { describe, expect, it, vi } from "vitest";

const { writeDashboardStageAnalyticsMock } = vi.hoisted(() => ({
  writeDashboardStageAnalyticsMock: vi.fn(),
}));

vi.mock("@/lib/metrics/analytics-engine", () => ({
  writeDashboardStageAnalytics: writeDashboardStageAnalyticsMock,
}));

vi.mock("@/lib/log/observability-clock", () => ({
  elapsedMs: vi.fn(() => 9),
  monotonicNowMs: vi.fn(() => 200),
}));

import {
  countDashboardStageQuery,
  countDashboardStageTransaction,
  createDashboardStageCounter,
  markDashboardStageCountsUnknown,
  observeDashboardStage,
} from "@/features/workspace/server/dashboard-stage-analytics";

describe("dashboard stage analytics", () => {
  it("writes a bounded dashboard stage from explicit counters", async () => {
    const counter = createDashboardStageCounter({
      dbContext: "rls",
      dbLabel: "app",
    });
    countDashboardStageQuery(counter);
    countDashboardStageTransaction(counter);

    await expect(
      observeDashboardStage({
        counter,
        details: () => ({ subscribedSectionCount: 3 }),
        stage: "nav_stats",
        work: async () => "ok",
      }),
    ).resolves.toBe("ok");

    expect(writeDashboardStageAnalyticsMock).toHaveBeenCalledWith({
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
    writeDashboardStageAnalyticsMock.mockReset();
    const counter = createDashboardStageCounter({
      dbContext: "none",
      dbLabel: "auth",
    });
    markDashboardStageCountsUnknown(counter);

    await expect(
      observeDashboardStage({
        counter,
        stage: "tab",
        work: async () => ({ ok: true }),
      }),
    ).resolves.toEqual({ ok: true });
    expect(writeDashboardStageAnalyticsMock).toHaveBeenCalledWith({
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

  it("keeps the dashboard result when the writer throws", async () => {
    writeDashboardStageAnalyticsMock.mockReset().mockImplementation(() => {
      throw new Error("analytics unavailable");
    });
    const counter = createDashboardStageCounter({
      dbContext: "none",
      dbLabel: "auth",
    });

    await expect(
      observeDashboardStage({
        counter,
        stage: "recent_session",
        work: async () => ({ ok: true }),
      }),
    ).resolves.toEqual({ ok: true });
  });
});
