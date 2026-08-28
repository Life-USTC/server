import { afterEach, describe, expect, it, vi } from "vitest";
import { createDeferred } from "../shared/deferred";

const { executeRawMock } = vi.hoisted(() => ({
  executeRawMock: vi.fn(),
}));

vi.mock("@/lib/db/auth-prisma", () => ({
  authPrisma: { $executeRaw: executeRawMock },
}));

import { runWithCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";
import {
  oauthGrantUsageKey,
  recordOAuthGrantUsage,
  scheduleOAuthGrantUsage,
} from "@/lib/oauth/grant-usage";

const usage = {
  userId: "user-1",
  clientId: "client-1",
  grantId: "unbound",
  channel: "rest" as const,
  feature: "account.profile",
  action: "read" as const,
  usedAt: new Date("2026-08-15T18:00:00.000Z"),
};

afterEach(() => {
  vi.useRealTimers();
  executeRawMock.mockReset();
});

describe.sequential("OAuth grant usage aggregation", () => {
  it("命名 grant key，避免真实 grantId 与无 grant 的 key 冲突", () => {
    expect(oauthGrantUsageKey("unbound")).toBe("grant:unbound");
    expect(oauthGrantUsageKey()).toBe("none");
  });

  it("按上海自然日、feature 与 channel 原子累计", async () => {
    executeRawMock.mockResolvedValue(1);
    await recordOAuthGrantUsage({ ...usage, count: 3, outcome: "error" });

    const statement = executeRawMock.mock.calls[0]?.[0] as {
      sql: string;
      values: unknown[];
    };
    expect(statement.sql).toContain(
      '"lastUsedAt" = GREATEST(\n        "OAuthGrantUsageDaily"."lastUsedAt",',
    );
    expect(statement.sql).toContain(
      'WHERE EXISTS (\n      SELECT 1 FROM "User"',
    );
    expect(statement.values).toEqual([
      expect.any(String),
      "user-1",
      "client-1",
      "unbound",
      "grant:unbound",
      new Date("2026-08-16T00:00:00.000Z"),
      "account.profile",
      "rest",
      3,
      0,
      3,
      usage.usedAt,
      "user-1",
      "client-1",
    ]);
  });

  it("无 Worker scheduler 时立即持久化而不是静默丢弃", async () => {
    executeRawMock.mockResolvedValue(1);
    await scheduleOAuthGrantUsage(usage);
    expect(executeRawMock).toHaveBeenCalledTimes(1);
  });

  it("Worker 内合并同维度请求，并继续刷新首批写入期间到达的数据", async () => {
    vi.useFakeTimers();
    const firstWrite = createDeferred<unknown>();
    executeRawMock
      .mockImplementationOnce(() => firstWrite.promise)
      .mockResolvedValue(1);
    const scheduled: Promise<unknown>[] = [];

    await runWithCloudflareRuntimeEnv(
      {},
      async () => {
        void scheduleOAuthGrantUsage(usage);
        void scheduleOAuthGrantUsage(usage);
        vi.advanceTimersByTime(100);
        await Promise.resolve();
        expect(executeRawMock).toHaveBeenCalledTimes(1);

        void scheduleOAuthGrantUsage({
          ...usage,
          feature: "workspace.todo",
        });
        firstWrite.resolve({});
        await Promise.resolve();
        await vi.advanceTimersByTimeAsync(100);
        await Promise.all(scheduled);
      },
      {
        waitUntil(promise: Promise<unknown>) {
          scheduled.push(promise);
        },
      },
    );

    expect(executeRawMock).toHaveBeenCalledTimes(2);
    expect(executeRawMock.mock.calls[0]?.[0].values[8]).toBe(2);
    expect(executeRawMock.mock.calls[1]?.[0].values[6]).toBe("workspace.todo");
  });
});
