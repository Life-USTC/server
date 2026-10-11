import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDeferred } from "../../../shared/deferred";

const { executeRawMock, connectMock, factoryMock, logAppEventMock } =
  vi.hoisted(() => ({
    executeRawMock: vi.fn(),
    connectMock: vi.fn(),
    factoryMock: vi.fn(),
    logAppEventMock: vi.fn(),
  }));

vi.mock("@prisma/adapter-pg", () => ({
  PrismaPg: class {
    constructor(config: unknown) {
      factoryMock(config);
    }
    connect() {
      return connectMock();
    }
  },
}));
vi.mock("@/app-env", () => ({
  getOptionalTrimmedEnv: (name: string) =>
    name.endsWith("DATABASE_URL")
      ? "postgresql://auth-role@localhost/test"
      : undefined,
}));
vi.mock("@/lib/log/app-logger", () => ({ logAppEvent: logAppEventMock }));
vi.mock("@/lib/metrics/analytics-engine", () => ({
  writeDatabaseEventAnalytics: vi.fn(),
}));

import {
  getCloudflareRuntimeContext,
  registerCloudflareRuntimeCleanup,
  runWithCloudflareRuntimeEnv,
} from "@/lib/adapters/cloudflare-runtime";
import {
  oauthGrantUsageKey,
  recordOAuthGrantUsage,
  scheduleOAuthGrantUsage,
} from "@/lib/oauth/grant-usage";

const runtimeEnv = {
  HYPERDRIVE_AUTH: {
    connectionString: "postgresql://auth-role@localhost/test",
  },
};

const usage = {
  userId: "user-1",
  clientId: "client-1",
  grantId: "unbound",
  channel: "rest" as const,
  feature: "account.profile",
  action: "read" as const,
  usedAt: new Date("2026-08-15T18:00:00.000Z"),
};

const adapters: {
  executeRaw: typeof executeRawMock;
  dispose: ReturnType<typeof vi.fn>;
}[] = [];
beforeEach(() => {
  adapters.length = 0;
  executeRawMock.mockReset().mockResolvedValue(1);
  factoryMock.mockReset();
  logAppEventMock.mockReset();
  connectMock.mockReset().mockImplementation(async () => {
    const adapter = {
      executeRaw: executeRawMock,
      dispose: vi.fn(async () => {}),
    };
    adapters.push(adapter);
    return adapter;
  });
});

afterEach(() => {
  vi.useRealTimers();
  executeRawMock.mockReset();
});

describe("OAuth grant usage aggregation", { concurrent: false }, () => {
  it("命名 grant key，避免真实 grantId 与无 grant 的 key 冲突", () => {
    expect(oauthGrantUsageKey("unbound")).toBe("grant:unbound");
    expect(oauthGrantUsageKey()).toBe("none");
  });

  it("按上海自然日、feature 与 channel 原子累计", async () => {
    executeRawMock.mockResolvedValue(1);
    await recordOAuthGrantUsage({ ...usage, count: 3, outcome: "error" });

    const statement = executeRawMock.mock.calls[0]?.[0] as {
      sql: string;
      args: unknown[];
    };
    expect(statement.sql).toContain(
      '"lastUsedAt" = GREATEST("OAuthGrantUsageDaily"."lastUsedAt",',
    );
    expect(statement.sql).toContain('WHERE EXISTS (SELECT 1 FROM "User"');
    expect(statement.args).toEqual([
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
      runtimeEnv,
      async () => {
        void scheduleOAuthGrantUsage(usage);
        void scheduleOAuthGrantUsage(usage);
        await vi.advanceTimersByTimeAsync(100);
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
    expect(executeRawMock.mock.calls[0]?.[0].args[8]).toBe(2);
    expect(executeRawMock.mock.calls[1]?.[0].args[6]).toBe("workspace.todo");
  });
  it("bounds pending dimensions while preserving overflow as singleton writes", async () => {
    vi.useFakeTimers();
    executeRawMock.mockResolvedValue(1);
    const scheduled: Promise<unknown>[] = [];
    await runWithCloudflareRuntimeEnv(
      runtimeEnv,
      async () => {
        for (let index = 0; index < 257; index++)
          void scheduleOAuthGrantUsage({ ...usage, grantId: `grant-${index}` });
        await Promise.resolve();
        expect(executeRawMock).toHaveBeenCalledTimes(1);
        expect(executeRawMock.mock.calls[0]?.[0].args[3]).toBe("grant-256");
        await vi.advanceTimersByTimeAsync(100);
        await Promise.all(scheduled);
      },
      {
        waitUntil(task: Promise<unknown>) {
          scheduled.push(task);
        },
      },
    );
    expect(executeRawMock).toHaveBeenCalledTimes(257);
    expect(adapters).toHaveLength(2);
    for (const adapter of adapters)
      expect(adapter.dispose).toHaveBeenCalledTimes(1);
  });

  it("owns and disposes the background adapter after the response has already cleaned up", async () => {
    vi.useFakeTimers();
    const scheduled: Promise<unknown>[] = [];
    const requestCleanup = vi.fn();
    let context: ReturnType<typeof getCloudflareRuntimeContext>;
    const response = await runWithCloudflareRuntimeEnv(
      runtimeEnv,
      async () => {
        context = getCloudflareRuntimeContext();
        context?.cache.set(Symbol("request-resource"), {});
        registerCloudflareRuntimeCleanup(requestCleanup);
        await scheduleOAuthGrantUsage(usage);
        return new Response("ok");
      },
      { waitUntil: (task: Promise<unknown>) => scheduled.push(task) },
    );

    expect(await response.text()).toBe("ok");
    expect(requestCleanup).toHaveBeenCalledTimes(1);
    expect(context?.cache.size).toBe(0);
    expect(context?.cleanups.size).toBe(0);
    expect(adapters).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(100);
    await Promise.all(scheduled);
    expect(executeRawMock).toHaveBeenCalledTimes(1);
    expect(adapters).toHaveLength(1);
    expect(adapters[0].dispose).toHaveBeenCalledTimes(1);
    expect(context?.cache.size).toBe(0);
    expect(context?.cleanups.size).toBe(0);
    expect(factoryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionString: "postgresql://auth-role@localhost/test",
      }),
    );
  });

  it("keeps separate requests on their own background tasks and connections", async () => {
    vi.useFakeTimers();
    const firstTasks: Promise<unknown>[] = [];
    const secondTasks: Promise<unknown>[] = [];
    await runWithCloudflareRuntimeEnv(
      runtimeEnv,
      () => scheduleOAuthGrantUsage(usage),
      {
        waitUntil: (task: Promise<unknown>) => firstTasks.push(task),
      },
    );
    await runWithCloudflareRuntimeEnv(
      runtimeEnv,
      () => scheduleOAuthGrantUsage(usage),
      {
        waitUntil: (task: Promise<unknown>) => secondTasks.push(task),
      },
    );
    expect(firstTasks[0]).not.toBe(secondTasks[0]);
    await vi.advanceTimersByTimeAsync(100);
    await Promise.all([...firstTasks, ...secondTasks]);
    expect(adapters).toHaveLength(2);
    expect(executeRawMock.mock.calls.map(([query]) => query.args[8])).toEqual([
      1, 1,
    ]);
    for (const adapter of adapters)
      expect(adapter.dispose).toHaveBeenCalledTimes(1);
  });

  it("waits for every in-flight write before disposing a failed batch", async () => {
    vi.useFakeTimers();
    const heldWrite = createDeferred<number>();
    executeRawMock
      .mockRejectedValueOnce(new Error("failed query"))
      .mockImplementationOnce(() => heldWrite.promise);
    const tasks: Promise<unknown>[] = [];
    await runWithCloudflareRuntimeEnv(
      runtimeEnv,
      async () => {
        await scheduleOAuthGrantUsage(usage);
        await scheduleOAuthGrantUsage({ ...usage, feature: "workspace.todo" });
      },
      { waitUntil: (task: Promise<unknown>) => tasks.push(task) },
    );
    await vi.advanceTimersByTimeAsync(100);
    expect(executeRawMock).toHaveBeenCalledTimes(2);
    expect(adapters).toHaveLength(1);
    expect(adapters[0].dispose).not.toHaveBeenCalled();
    heldWrite.resolve(1);
    await Promise.all(tasks);
    expect(adapters[0].dispose).toHaveBeenCalledTimes(1);
    expect(logAppEventMock).toHaveBeenCalledWith(
      "error",
      "OAuth grant usage batch write failed",
      expect.anything(),
      expect.any(AggregateError),
    );
  });

  it("disposes direct writes on rejection and schedules failures without failing the response", async () => {
    executeRawMock.mockRejectedValue(new Error("database unavailable"));
    await expect(recordOAuthGrantUsage(usage)).rejects.toThrow(
      "OAuth grant usage batch write failed",
    );
    await expect(scheduleOAuthGrantUsage(usage)).resolves.toBeUndefined();
    expect(adapters).toHaveLength(2);
    for (const adapter of adapters)
      expect(adapter.dispose).toHaveBeenCalledTimes(1);
    expect(logAppEventMock).toHaveBeenCalledTimes(1);
  });
});
