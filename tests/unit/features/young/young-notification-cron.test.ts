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

it("bounds admitted owner work to the runtime pool capacity", async () => {
  const { RUNTIME_DATABASE_POOL_CAPACITY: capacity } = await import(
    "@/lib/db/runtime-pool-capacity"
  );
  const users = Array.from({ length: capacity * 3 }, (_, index) => ({
    id: `owner-${index}`,
  }));
  const query = vi.fn().mockResolvedValueOnce(users).mockResolvedValueOnce([]);
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let active = 0;
  let peak = 0;
  refresh.mockImplementation(async () => {
    active += 1;
    peak = Math.max(peak, active);
    try {
      await gate;
    } finally {
      active -= 1;
    }
  });
  const work = runYoungNotificationCron({
    $queryRaw: query,
  } as unknown as PrismaClient);
  const observed = work.then(
    () => undefined,
    () => undefined,
  );
  try {
    await expect.poll(() => refresh.mock.calls.length).toBe(capacity);
    expect(active).toBe(capacity);
  } finally {
    release();
    await observed;
  }
  expect(await work).toEqual({ processed: users.length });
  expect(peak).toBe(capacity);
  expect(active).toBe(0);
});

it("joins admitted owners before rejecting and does not start another batch", async () => {
  const { RUNTIME_DATABASE_POOL_CAPACITY: capacity } = await import(
    "@/lib/db/runtime-pool-capacity"
  );
  const failure = new Error("Owner write failed");
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  refresh.mockImplementation((userId: string) =>
    userId === "owner-0" ? Promise.reject(failure) : gate,
  );
  const query = vi.fn().mockResolvedValueOnce(
    Array.from({ length: capacity + 1 }, (_, index) => ({
      id: `owner-${index}`,
    })),
  );
  const work = runYoungNotificationCron({
    $queryRaw: query,
  } as unknown as PrismaClient);
  let settled = false;
  const observed = work.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );
  try {
    await expect.poll(() => refresh.mock.calls.length).toBe(capacity);
    expect(settled).toBe(false);
  } finally {
    release();
    await observed;
  }
  await expect(work).rejects.toBe(failure);
  expect(refresh).toHaveBeenCalledTimes(capacity);
});
