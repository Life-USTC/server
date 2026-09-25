import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getCachedUserCalendarExport,
  invalidateUserCalendarExportCache,
  requestMatchesEtag,
  resetUserCalendarExportCacheForTest,
  USER_CALENDAR_EXPORT_FRESH_TTL_MS,
} from "@/features/calendar/server/calendar-export-cache";
import {
  scheduleUserCalendarExportRebuild,
  setCalendarExportRebuildSenderForTest,
} from "@/features/calendar/server/calendar-export-queue";
import { setCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";

const calendarExport = {
  cacheControl: "private, max-age=1800",
  filename: "life-ustc-subscriptions.ics",
  text: "BEGIN:VCALENDAR\nEND:VCALENDAR",
};

function kvNamespace() {
  const values = new Map<string, string>();
  return {
    delete: vi.fn(async (key: string) => {
      values.delete(key);
    }),
    get: vi.fn(async (key: string) => {
      const value = values.get(key);
      return value ? JSON.parse(value) : null;
    }),
    put: vi.fn(async (key: string, value: string) => {
      values.set(key, value);
    }),
  };
}

describe("用户 iCal 导出缓存", () => {
  afterEach(() => {
    resetUserCalendarExportCacheForTest();
    setCalendarExportRebuildSenderForTest(undefined);
    setCloudflareRuntimeEnv(undefined);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("跨 isolate 从 KV 复用 fresh 导出", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    const namespace = kvNamespace();
    const writeDataPoint = vi.fn();
    setCloudflareRuntimeEnv({
      ANALYTICS: { writeDataPoint },
      CALENDAR_EXPORTS: namespace,
    });
    const buildExport = vi.fn().mockResolvedValue(calendarExport);

    const first = await getCachedUserCalendarExport("user-1", buildExport);
    resetUserCalendarExportCacheForTest();
    const second = await getCachedUserCalendarExport("user-1", buildExport);

    expect(first.status).toBe("miss");
    expect(second.status).toBe("fresh");
    expect(buildExport).toHaveBeenCalledTimes(1);
    expect(namespace.put).toHaveBeenCalledWith(
      "user-calendar:v2:user-1",
      expect.any(String),
      { expirationTtl: 86_400 },
    );
    expect(namespace.get).toHaveBeenLastCalledWith("user-calendar:v2:user-1", {
      cacheTtl: 60,
      type: "json",
    });
    expect(second.calendar?.etag).toMatch(/^"sha256-[A-Za-z0-9_-]+"$/);

    expect(writeDataPoint).toHaveBeenCalledWith({
      indexes: ["cache:calendar:user"],
      blobs: ["calendar_feed_cache", "user", "miss"],
      doubles: [USER_CALENDAR_EXPORT_FRESH_TTL_MS, 0],
    });
    expect(writeDataPoint).toHaveBeenCalledWith({
      indexes: ["cache:calendar:user"],
      blobs: ["calendar_feed_cache", "user", "fresh"],
      doubles: [USER_CALENDAR_EXPORT_FRESH_TTL_MS, 1],
    });
    expect(JSON.stringify(writeDataPoint.mock.calls)).not.toContain("user-1");
  });

  it("stale 导出立即返回且通过 defer 跟踪 enqueue Promise", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    const namespace = kvNamespace();
    setCloudflareRuntimeEnv({ CALENDAR_EXPORTS: namespace });
    const enqueued: unknown[] = [];
    let finishEnqueue: (() => void) | undefined;
    setCalendarExportRebuildSenderForTest((message) => {
      enqueued.push(message);
      return new Promise<void>((resolve) => {
        finishEnqueue = resolve;
      });
    });
    const buildExport = vi.fn().mockResolvedValue(calendarExport);

    await getCachedUserCalendarExport("user-1", buildExport);
    vi.advanceTimersByTime(USER_CALENDAR_EXPORT_FRESH_TTL_MS + 1);
    const tasks: Promise<unknown>[] = [];
    const stale = await getCachedUserCalendarExport("user-1", buildExport, {
      defer: (promise) => tasks.push(promise),
    });

    expect(stale.status).toBe("stale");
    expect(stale.calendar?.text).toBe(calendarExport.text);
    expect(tasks).toHaveLength(1);
    expect(buildExport).toHaveBeenCalledTimes(1);
    expect(enqueued).toHaveLength(1);
    expect(enqueued[0]).toEqual({ type: "user", userId: "user-1" });
    finishEnqueue?.();
    await expect(tasks[0]).resolves.toBeUndefined();

    // Repeated polling retains the stale response without another rebuild.
    const stillStale = await getCachedUserCalendarExport("user-1", buildExport);
    expect(stillStale.status).toBe("stale");
    expect(stillStale.calendar?.text).toBe(calendarExport.text);
    expect(buildExport).toHaveBeenCalledTimes(1);
    expect(enqueued).toHaveLength(1);
  });

  it("serving isolate observes a consumer's KV refresh after revalidation", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    const namespace = kvNamespace();
    setCloudflareRuntimeEnv({ CALENDAR_EXPORTS: namespace });
    const sender = vi.fn().mockResolvedValue(undefined);
    setCalendarExportRebuildSenderForTest(sender);
    const buildExport = vi.fn().mockResolvedValue(calendarExport);

    await getCachedUserCalendarExport("user-1", buildExport);
    vi.advanceTimersByTime(USER_CALENDAR_EXPORT_FRESH_TTL_MS + 1);
    expect(
      (await getCachedUserCalendarExport("user-1", buildExport)).status,
    ).toBe("stale");

    // Load a separate module graph: the queue consumer has its own memory map,
    // but both isolates share the same persistent KV namespace.
    vi.resetModules();
    const consumerCache = await import(
      "@/features/calendar/server/calendar-export-cache"
    );
    const consumerRuntime = await import("@/lib/adapters/cloudflare-runtime");
    consumerRuntime.setCloudflareRuntimeEnv({ CALENDAR_EXPORTS: namespace });
    try {
      vi.advanceTimersByTime(10_000);
      const updated = {
        ...calendarExport,
        text: `${calendarExport.text}\nnew`,
      };
      await consumerCache.storeBuiltUserCalendarExport("user-1", updated);

      const beforeRevalidation = await getCachedUserCalendarExport(
        "user-1",
        buildExport,
      );
      expect(beforeRevalidation.calendar?.text).toBe(calendarExport.text);
      expect(sender).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(50_000);
      const refreshed = await getCachedUserCalendarExport(
        "user-1",
        buildExport,
      );
      expect(refreshed.status).toBe("fresh");
      expect(refreshed.calendar?.text).toBe(updated.text);
      expect(sender).toHaveBeenCalledTimes(1);
      expect(buildExport).toHaveBeenCalledTimes(1);
    } finally {
      consumerCache.resetUserCalendarExportCacheForTest();
      consumerRuntime.setCloudflareRuntimeEnv(undefined);
    }
  });

  it("bounds repeated stale enqueues while KV still contains the old export", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    const namespace = kvNamespace();
    setCloudflareRuntimeEnv({ CALENDAR_EXPORTS: namespace });
    const sender = vi.fn().mockResolvedValue(undefined);
    setCalendarExportRebuildSenderForTest(sender);
    const buildExport = vi.fn().mockResolvedValue(calendarExport);
    await getCachedUserCalendarExport("user-1", buildExport);
    vi.advanceTimersByTime(USER_CALENDAR_EXPORT_FRESH_TTL_MS + 1);

    for (let minute = 0; minute < 3; minute += 1) {
      const polls = await Promise.all(
        Array.from({ length: 10 }, () =>
          getCachedUserCalendarExport("user-1", buildExport),
        ),
      );
      expect(polls.every((poll) => poll.status === "stale")).toBe(true);
      expect(sender).toHaveBeenCalledTimes(minute + 1);
      vi.advanceTimersByTime(60_000);
    }
    expect(buildExport).toHaveBeenCalledTimes(1);
  });

  it("write-triggered rebuilds bypass the stale-read cooldown", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    const sender = vi.fn().mockResolvedValue(undefined);
    setCalendarExportRebuildSenderForTest(sender);
    const buildExport = vi.fn().mockResolvedValue(calendarExport);
    await getCachedUserCalendarExport("user-1", buildExport);
    vi.advanceTimersByTime(USER_CALENDAR_EXPORT_FRESH_TTL_MS + 1);
    await getCachedUserCalendarExport("user-1", buildExport);

    const tasks: Promise<unknown>[] = [];
    scheduleUserCalendarExportRebuild("user-1", (task) => tasks.push(task));
    await Promise.all(tasks);
    expect(sender).toHaveBeenCalledTimes(2);
  });

  it("failed KV revalidation keeps the export without postponing the next read", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    const namespace = kvNamespace();
    setCloudflareRuntimeEnv({ CALENDAR_EXPORTS: namespace });
    const buildExport = vi.fn().mockResolvedValue(calendarExport);
    const first = await getCachedUserCalendarExport("user-1", buildExport);
    vi.advanceTimersByTime(60_000);
    namespace.get.mockRejectedValueOnce(new Error("KV unavailable"));
    const cached = await getCachedUserCalendarExport("user-1", buildExport);
    expect(cached.calendar?.text).toBe(calendarExport.text);
    expect(buildExport).toHaveBeenCalledTimes(1);

    const updated = {
      ...first.calendar,
      text: "updated by another isolate",
      generatedAtMs: Date.now(),
      version: 2,
    };
    namespace.get.mockResolvedValueOnce(updated);
    const refreshed = await getCachedUserCalendarExport("user-1", buildExport);
    expect(refreshed.calendar?.text).toBe(updated.text);
    expect(namespace.get).toHaveBeenCalledTimes(3);
  });

  it("invalidation removes the local stale enqueue cooldown", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    const namespace = kvNamespace();
    setCloudflareRuntimeEnv({ CALENDAR_EXPORTS: namespace });
    const sender = vi.fn().mockResolvedValue(undefined);
    setCalendarExportRebuildSenderForTest(sender);
    const buildExport = vi.fn().mockResolvedValue(calendarExport);
    await getCachedUserCalendarExport("user-1", buildExport);
    vi.advanceTimersByTime(USER_CALENDAR_EXPORT_FRESH_TTL_MS + 1);
    await getCachedUserCalendarExport("user-1", buildExport);
    const oldKvValue = await namespace.get("user-calendar:v2:user-1");

    await invalidateUserCalendarExportCache("user-1");
    // An edge may still see the old value during KV delete propagation.
    namespace.get.mockResolvedValueOnce(oldKvValue);
    await getCachedUserCalendarExport("user-1", buildExport);
    expect(sender).toHaveBeenCalledTimes(2);
  });

  it("cold miss 将 KV 写入移出响应关键路径", async () => {
    let finishPut: (() => void) | undefined;
    const namespace = {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finishPut = resolve;
          }),
      ),
    };
    setCloudflareRuntimeEnv({ CALENDAR_EXPORTS: namespace });
    const tasks: Promise<unknown>[] = [];

    const result = await getCachedUserCalendarExport(
      "user-1",
      vi.fn().mockResolvedValue(calendarExport),
      { defer: (promise) => tasks.push(promise) },
    );

    expect(result.status).toBe("miss");
    expect(namespace.put).toHaveBeenCalledOnce();
    expect(tasks).toHaveLength(1);

    finishPut?.();
    await expect(tasks[0]).resolves.toBeUndefined();
  });

  it("refresh 失败时记录 refresh_error 且保留失败结果", async () => {
    const writeDataPoint = vi.fn();
    setCloudflareRuntimeEnv({ ANALYTICS: { writeDataPoint } });
    const refreshFailure = new Error("private refresh detail");

    await expect(
      getCachedUserCalendarExport(
        "user-1",
        vi.fn().mockRejectedValue(refreshFailure),
      ),
    ).rejects.toBe(refreshFailure);

    expect(writeDataPoint).toHaveBeenCalledWith({
      indexes: ["cache:calendar:user"],
      blobs: ["calendar_feed_cache", "user", "refresh_error"],
      doubles: [USER_CALENDAR_EXPORT_FRESH_TTL_MS, 0],
    });
    expect(JSON.stringify(writeDataPoint.mock.calls)).not.toContain(
      "private refresh detail",
    );
  });

  it("合并同一 isolate 内的并发 miss", async () => {
    const namespace = kvNamespace();
    setCloudflareRuntimeEnv({ CALENDAR_EXPORTS: namespace });
    let resolveBuild: ((value: typeof calendarExport) => void) | undefined;
    const buildExport = vi.fn(
      () =>
        new Promise<typeof calendarExport>((resolve) => {
          resolveBuild = resolve;
        }),
    );

    const first = getCachedUserCalendarExport("user-1", buildExport);
    const second = getCachedUserCalendarExport("user-1", buildExport);
    await vi.waitFor(() => expect(buildExport).toHaveBeenCalledTimes(1));
    resolveBuild?.(calendarExport);

    const results = await Promise.all([first, second]);
    expect(results.map((result) => result.status)).toEqual(["miss", "miss"]);
    expect(namespace.put).toHaveBeenCalledTimes(1);
  });

  it("无 defer 时仍立即返回 stale 且不在请求路径重建", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    const enqueued: unknown[] = [];
    setCalendarExportRebuildSenderForTest(async (message) => {
      enqueued.push(message);
    });
    const buildExport = vi.fn().mockResolvedValue(calendarExport);

    await getCachedUserCalendarExport("user-1", buildExport);
    vi.advanceTimersByTime(USER_CALENDAR_EXPORT_FRESH_TTL_MS + 1);
    const stale = await getCachedUserCalendarExport("user-1", buildExport);

    expect(stale.status).toBe("stale");
    expect(stale.calendar?.text).toBe(calendarExport.text);
    // Request path must not call buildExport again; rebuild is queued.
    expect(buildExport).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(enqueued).toHaveLength(1));
    expect(enqueued[0]).toEqual({ type: "user", userId: "user-1" });
  });

  it("stale enqueue 失败时仍立即返回并暴露失败指标", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    const namespace = kvNamespace();
    const writeDataPoint = vi.fn();
    setCloudflareRuntimeEnv({
      ANALYTICS: { writeDataPoint },
      CALENDAR_EXPORTS: namespace,
    });
    setCalendarExportRebuildSenderForTest(() =>
      Promise.reject(new Error("private user id")),
    );
    const buildExport = vi.fn().mockResolvedValue(calendarExport);

    await getCachedUserCalendarExport("user-1", buildExport);
    vi.advanceTimersByTime(USER_CALENDAR_EXPORT_FRESH_TTL_MS + 1);
    const tasks: Promise<unknown>[] = [];
    const stale = await getCachedUserCalendarExport("user-1", buildExport, {
      defer: (promise) => tasks.push(promise),
    });

    expect(stale.status).toBe("stale");
    expect(stale.calendar?.text).toBe(calendarExport.text);
    expect(tasks).toHaveLength(1);
    await expect(tasks[0]).rejects.toThrow("private user id");
    expect(writeDataPoint).toHaveBeenCalledWith({
      indexes: ["calendar_export_rebuild_enqueue_error"],
      blobs: ["calendar_export_rebuild", "enqueue_error"],
      doubles: [1],
    });
    expect(JSON.stringify(writeDataPoint.mock.calls)).not.toContain(
      "private user id",
    );

    const retrySender = vi.fn().mockResolvedValue(undefined);
    setCalendarExportRebuildSenderForTest(retrySender);
    await getCachedUserCalendarExport("user-1", buildExport, {
      defer: (promise) => tasks.push(promise),
    });
    await expect(tasks[1]).resolves.toBeUndefined();
    expect(retrySender).toHaveBeenCalledOnce();
  });

  it("KV store 失败时不记录 refresh_success", async () => {
    const writeDataPoint = vi.fn();
    const namespace = {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockRejectedValue(new Error("private storage detail")),
    };
    setCloudflareRuntimeEnv({
      ANALYTICS: { writeDataPoint },
      CALENDAR_EXPORTS: namespace,
    });

    await expect(
      getCachedUserCalendarExport(
        "user-1",
        vi.fn().mockResolvedValue(calendarExport),
      ),
    ).rejects.toThrow("Calendar export cache persistence failed");

    expect(writeDataPoint).toHaveBeenCalledWith({
      indexes: ["cache:calendar:user"],
      blobs: ["calendar_feed_cache", "user", "store_error"],
      doubles: [USER_CALENDAR_EXPORT_FRESH_TTL_MS, 1],
    });
    expect(writeDataPoint).not.toHaveBeenCalledWith({
      indexes: ["cache:calendar:user"],
      blobs: ["calendar_feed_cache", "user", "refresh_success"],
      doubles: [USER_CALENDAR_EXPORT_FRESH_TTL_MS, 1],
    });
    expect(JSON.stringify(writeDataPoint.mock.calls)).not.toContain(
      "private storage detail",
    );
  });

  it("KV 不可用时仍使用 isolate 内存缓存", async () => {
    const buildExport = vi.fn().mockResolvedValue(calendarExport);

    const first = await getCachedUserCalendarExport("user-1", buildExport);
    const second = await getCachedUserCalendarExport("user-1", buildExport);

    expect(first.status).toBe("miss");
    expect(second.status).toBe("fresh");
    expect(buildExport).toHaveBeenCalledTimes(1);
  });

  it("不缓存空日历结果", async () => {
    const buildExport = vi.fn().mockResolvedValue(null);

    await getCachedUserCalendarExport("user-1", buildExport);
    await getCachedUserCalendarExport("user-1", buildExport);

    expect(buildExport).toHaveBeenCalledTimes(2);
  });

  it("匹配强 ETag、弱 ETag 和多值 If-None-Match", () => {
    const etag = '"sha256-calendar"';

    expect(
      requestMatchesEtag(
        new Request("https://example.test", {
          headers: { "If-None-Match": '"other", W/"sha256-calendar"' },
        }),
        etag,
      ),
    ).toBe(true);
    expect(
      requestMatchesEtag(
        new Request("https://example.test", {
          headers: { "If-None-Match": '"other"' },
        }),
        etag,
      ),
    ).toBe(false);
  });

  it("deletes cached exports from memory and KV", async () => {
    const namespace = kvNamespace();
    setCloudflareRuntimeEnv({ CALENDAR_EXPORTS: namespace });

    const buildExport = vi.fn(async () => calendarExport);
    await getCachedUserCalendarExport("user-1", buildExport);
    expect(buildExport).toHaveBeenCalledOnce();

    await invalidateUserCalendarExportCache("user-1");
    await getCachedUserCalendarExport("user-1", buildExport);

    expect(buildExport).toHaveBeenCalledTimes(2);
    expect(namespace.delete).toHaveBeenCalledWith("user-calendar:v2:user-1");
  });
});
