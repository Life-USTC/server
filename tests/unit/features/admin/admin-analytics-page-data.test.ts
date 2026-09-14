import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  auditGroupByMock,
  clientFindManyMock,
  dailyQueryMock,
  requireAdminPageMock,
  usageGroupByMock,
  telemetryReadMock,
} = vi.hoisted(() => ({
  auditGroupByMock: vi.fn(),
  clientFindManyMock: vi.fn(),
  dailyQueryMock: vi.fn(),
  requireAdminPageMock: vi.fn(),
  usageGroupByMock: vi.fn(),
  telemetryReadMock: vi.fn(),
}));

vi.mock("@/features/admin/server/admin-page-auth", () => ({
  requireAdminPage: requireAdminPageMock,
}));

vi.mock("@/features/admin/server/admin-experience-page-data", () => ({
  readAdminFeatureTelemetry: telemetryReadMock,
  readAdminFeatureIssues: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    auditLog: { groupBy: auditGroupByMock },
    oAuthGrantUsageDaily: { groupBy: usageGroupByMock },
    $queryRaw: dailyQueryMock,
  },
  withUserDbContext: vi.fn((_userId, action) =>
    action({
      auditLog: { groupBy: auditGroupByMock },
      oAuthGrantUsageDaily: { groupBy: usageGroupByMock },
      $queryRaw: dailyQueryMock,
    }),
  ),
}));

vi.mock("@/lib/db/auth-prisma", () => ({
  authPrisma: { oAuthClient: { findMany: clientFindManyMock } },
}));

import { getAdminAnalyticsPage } from "@/features/admin/server/admin-audit-page-data";

describe("admin analytics aggregation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminPageMock.mockResolvedValue({ id: "admin-1" });
    auditGroupByMock.mockResolvedValue([]);
    usageGroupByMock.mockResolvedValue([]);
    clientFindManyMock.mockResolvedValue([]);
    dailyQueryMock.mockResolvedValue([]);
    telemetryReadMock.mockResolvedValue({
      status: { state: "unavailable", reason: "not_configured" },
      rows: [],
    });
  });

  it("merges bounded OAuth usage and separates success from errors", async () => {
    usageGroupByMock.mockResolvedValue([
      {
        _sum: { errorCount: 2, readCount: 5, writeCount: 1 },
        channel: "graphql",
        clientId: "client-1",
        feature: "workspace.todo",
      },
    ]);
    dailyQueryMock.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        channel: "graphql",
        count: 5n,
        day: "2026-09-13",
        feature: "workspace.todo",
        operation: "read",
      },
      {
        channel: "graphql",
        count: 1n,
        day: "2026-09-13",
        feature: "workspace.todo",
        operation: "write",
      },
    ]);
    clientFindManyMock.mockResolvedValue([
      { clientId: "client-1", name: "Planner" },
    ]);

    const result = await getAdminAnalyticsPage(
      new Request("https://life.example/admin/analytics"),
      new URL("https://life.example/admin/analytics?days=7"),
    );

    expect(requireAdminPageMock).toHaveBeenCalledTimes(1);
    expect(telemetryReadMock).toHaveBeenCalledTimes(1);
    expect(result.telemetry.status.state).toBe("unavailable");
    expect(result.total).toBe(6);
    expect(result.summary).toEqual({
      activeClients: 1,
      denied: 0,
      external: 6,
      failure: 2,
      success: 4,
      total: 6,
    });
    expect(result.rankings.features).toEqual([
      { count: 6, failures: 2, label: "workspace.todo" },
    ]);
    expect(result.trends).toEqual([
      {
        channel: "graphql",
        count: 5,
        day: "2026-09-13",
        feature: "workspace.todo",
        operation: "read",
      },
      {
        channel: "graphql",
        count: 1,
        day: "2026-09-13",
        feature: "workspace.todo",
        operation: "write",
      },
    ]);
    expect(result.daily).toHaveLength(7);
    expect(result.daily.at(-1)?.partial).toBe(true);
    expect(auditGroupByMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({
            gte: expect.any(Date),
            lt: expect.any(Date),
          }),
          OR: [
            { oauthClientId: null },
            { channel: { notIn: ["rest", "graphql", "mcp"] } },
          ],
        }),
      }),
    );
  });

  it("does not merge two clients that happen to share a display name", async () => {
    usageGroupByMock.mockResolvedValue([
      {
        _sum: { errorCount: 0, readCount: 1, writeCount: 0 },
        channel: "rest",
        clientId: "client-1",
        feature: "catalog.course",
      },
      {
        _sum: { errorCount: 0, readCount: 2, writeCount: 0 },
        channel: "rest",
        clientId: "client-2",
        feature: "catalog.course",
      },
    ]);
    clientFindManyMock.mockResolvedValue([
      { clientId: "client-1", name: "Shared name" },
      { clientId: "client-2", name: "Shared name" },
    ]);

    const result = await getAdminAnalyticsPage(
      new Request("https://life.example/admin/analytics"),
      new URL("https://life.example/admin/analytics"),
    );

    expect(result.rankings.clients).toHaveLength(2);
    expect(result.total).toBe(3);
  });
});

it("rejects unauthorized readers before either statistics source is accessed", async () => {
  vi.clearAllMocks();
  const denial = new Error("Forbidden");
  requireAdminPageMock.mockRejectedValueOnce(denial);
  await expect(
    getAdminAnalyticsPage(
      new Request("https://life.example/admin/analytics"),
      new URL("https://life.example/admin/analytics"),
    ),
  ).rejects.toBe(denial);
  expect(auditGroupByMock).not.toHaveBeenCalled();
  expect(telemetryReadMock).not.toHaveBeenCalled();
});
