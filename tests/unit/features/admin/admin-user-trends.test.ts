import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authCountMock,
  authQueryMock,
  featureQueryMock,
  withUserDbContextMock,
} = vi.hoisted(() => ({
  authCountMock: vi.fn(),
  authQueryMock: vi.fn(),
  featureQueryMock: vi.fn(),
  withUserDbContextMock: vi.fn(),
}));

vi.mock("@/lib/db/auth-prisma", () => ({
  authPrisma: {
    user: { count: authCountMock },
    $queryRaw: authQueryMock,
  },
}));

vi.mock("@/lib/db/prisma", () => ({
  withUserDbContext: withUserDbContextMock,
}));

import {
  buildAdminUserTrendsWindow,
  parseAdminUserTrendsDays,
  readAdminUserTrends,
} from "@/features/admin/server/admin-user-trends";

const now = new Date("2026-09-14T04:00:00.000Z");
const url = new URL("https://life.example/admin/analytics?days=7");

describe("admin user trends", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authCountMock.mockResolvedValue(20);
    authQueryMock.mockResolvedValue([
      { count: 2, day: "2026-09-10" },
      { count: 1, day: "2026-09-14" },
    ]);
    featureQueryMock
      .mockResolvedValueOnce([
        { activeUsers: 1, day: "2026-09-10" },
        { activeUsers: 2, day: "2026-09-12" },
      ])
      .mockResolvedValueOnce([{ activeUsers: 2 }])
      .mockResolvedValueOnce([{ first: new Date("2026-09-10T01:00:00.000Z") }]);
    withUserDbContextMock.mockImplementation((_adminId, action) =>
      action({ $queryRaw: featureQueryMock }),
    );
  });

  it("bounds retained registrations and identified activity to Shanghai days", async () => {
    const result = await readAdminUserTrends("admin-1", url, { now });

    expect(result).toMatchObject({
      coverage: {
        fromDay: "2026-09-08",
        includesToday: true,
        timezone: "Asia/Shanghai",
        toDayExclusive: "2026-09-15",
      },
      days: 7,
      firstRecordedAt: "2026-09-10T01:00:00.000Z",
      status: { state: "ready" },
      summary: {
        currentUsers: 20,
        periodActiveUsers: 2,
        periodRegisteredUsers: 3,
      },
    });
    expect(result.daily).toEqual([
      {
        activeUsers: null,
        day: "2026-09-08",
        partial: false,
        registeredUsers: 0,
      },
      {
        activeUsers: null,
        day: "2026-09-09",
        partial: false,
        registeredUsers: 0,
      },
      { activeUsers: 1, day: "2026-09-10", partial: false, registeredUsers: 2 },
      { activeUsers: 0, day: "2026-09-11", partial: false, registeredUsers: 0 },
      { activeUsers: 2, day: "2026-09-12", partial: false, registeredUsers: 0 },
      { activeUsers: 0, day: "2026-09-13", partial: false, registeredUsers: 0 },
      { activeUsers: 0, day: "2026-09-14", partial: true, registeredUsers: 1 },
    ]);
    expect(withUserDbContextMock).toHaveBeenCalledWith(
      "admin-1",
      expect.any(Function),
    );
    expect(authCountMock).toHaveBeenCalledTimes(1);
    expect(authQueryMock).toHaveBeenCalledTimes(1);
    expect(featureQueryMock).toHaveBeenCalledTimes(3);
  });

  it("keeps activity unknown before the first observed event", async () => {
    featureQueryMock.mockReset();
    featureQueryMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ activeUsers: 0 }])
      .mockResolvedValueOnce([{ first: null }]);

    const result = await readAdminUserTrends("admin-1", url, { now });

    expect(result.firstRecordedAt).toBeNull();
    expect(result.summary.periodActiveUsers).toBeNull();
    expect(result.daily.every((entry) => entry.activeUsers === null)).toBe(
      true,
    );
  });

  it("returns a bounded unavailable model when either source cannot be read", async () => {
    authCountMock.mockRejectedValueOnce(new Error("database unavailable"));

    const result = await readAdminUserTrends("admin-1", url, { now });

    expect(result.status).toEqual({
      reason: "query_failed",
      state: "unavailable",
    });
    expect(result.daily).toHaveLength(7);
    expect(result.daily.at(-1)?.partial).toBe(true);
    expect(withUserDbContextMock).toHaveBeenCalledTimes(1);
  });

  it("accepts only the supported bounded windows", () => {
    expect(parseAdminUserTrendsDays("7")).toBe(7);
    expect(parseAdminUserTrendsDays("90")).toBe(90);
    expect(parseAdminUserTrendsDays("365")).toBe(30);
    expect(parseAdminUserTrendsDays(undefined)).toBe(30);

    expect(buildAdminUserTrendsWindow(7, now)).toMatchObject({
      fromDay: "2026-09-08",
      todayDay: "2026-09-14",
      toDayExclusive: "2026-09-15",
    });
  });
});
