import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("@/features/young/server/young-notification-service", () => ({
  refreshYoungNotifications: refresh,
}));

import { runYoungNotificationCron } from "@/features/young/server/young-notification-cron";

beforeEach(() => vi.resetAllMocks());
describe("Young notification recipient sweep", () => {
  it("advances through all recipient pages and uses the same clock for each owner", async () => {
    const now = new Date("2035-09-15T02:00:00Z");
    const query = vi
      .fn()
      .mockResolvedValueOnce(
        Array.from({ length: 100 }, (_, i) => ({ id: `u${i}` })),
      )
      .mockResolvedValueOnce([{ id: "last" }])
      .mockResolvedValueOnce([]);
    const result = await runYoungNotificationCron(
      { $queryRaw: query } as unknown as PrismaClient,
      now,
    );
    expect(result).toEqual({ processed: 101 });
    expect(refresh).toHaveBeenCalledTimes(101);
    expect(refresh).toHaveBeenLastCalledWith("last", now);
    expect(query.mock.calls[0][1]).toBeNull();
    expect(query.mock.calls[1][1]).toBe("u99");
    expect(query.mock.calls[2][1]).toBe("last");
  });
  it("does no owner work for an empty recipient list", async () => {
    expect(
      await runYoungNotificationCron({
        $queryRaw: vi.fn().mockResolvedValue([]),
      } as unknown as PrismaClient),
    ).toEqual({ processed: 0 });
    expect(refresh).not.toHaveBeenCalled();
  });
  it("surfaces failures so the scheduled invocation cannot report false success", async () => {
    refresh.mockRejectedValue(new Error("write failed"));
    await expect(
      runYoungNotificationCron({
        $queryRaw: vi.fn().mockResolvedValue([{ id: "u" }]),
      } as unknown as PrismaClient),
    ).rejects.toThrow("write failed");
  });
});
