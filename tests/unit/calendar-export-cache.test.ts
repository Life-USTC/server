import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getCachedUserCalendarExport,
  requestMatchesEtag,
  resetUserCalendarExportCacheForTest,
  USER_CALENDAR_EXPORT_FRESH_TTL_MS,
} from "@/features/calendar/server/calendar-export-cache";
import { setCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";

const calendarExport = {
  cacheControl: "private, max-age=300",
  filename: "life-ustc-subscriptions.ics",
  text: "BEGIN:VCALENDAR\nEND:VCALENDAR",
};

function kvNamespace() {
  const values = new Map<string, string>();
  return {
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
      "user-calendar:v1:user-1",
      expect.any(String),
      { expirationTtl: 86_400 },
    );
    expect(namespace.get).toHaveBeenLastCalledWith("user-calendar:v1:user-1", {
      cacheTtl: 30,
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

  it("stale 导出立即返回并通过 defer 后台刷新", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    const namespace = kvNamespace();
    setCloudflareRuntimeEnv({ CALENDAR_EXPORTS: namespace });
    const buildExport = vi
      .fn()
      .mockResolvedValueOnce(calendarExport)
      .mockResolvedValueOnce({
        ...calendarExport,
        text: "BEGIN:VCALENDAR\nX-UPDATED:1\nEND:VCALENDAR",
      });

    await getCachedUserCalendarExport("user-1", buildExport);
    vi.advanceTimersByTime(USER_CALENDAR_EXPORT_FRESH_TTL_MS + 1);
    const tasks: Promise<unknown>[] = [];
    const stale = await getCachedUserCalendarExport("user-1", buildExport, {
      defer: (promise) => tasks.push(promise),
    });

    expect(stale.status).toBe("stale");
    expect(stale.calendar?.text).toBe(calendarExport.text);
    expect(tasks).toHaveLength(1);

    await tasks[0];
    const refreshed = await getCachedUserCalendarExport("user-1", buildExport);
    expect(refreshed.status).toBe("fresh");
    expect(refreshed.calendar?.text).toContain("X-UPDATED:1");
    expect(buildExport).toHaveBeenCalledTimes(2);
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

  it("后台刷新失败时继续返回 stale 导出", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    const buildExport = vi
      .fn()
      .mockResolvedValueOnce(calendarExport)
      .mockRejectedValueOnce(new Error("database unavailable"));

    await getCachedUserCalendarExport("user-1", buildExport);
    vi.advanceTimersByTime(USER_CALENDAR_EXPORT_FRESH_TTL_MS + 1);
    const tasks: Promise<unknown>[] = [];
    const stale = await getCachedUserCalendarExport("user-1", buildExport, {
      defer: (promise) => tasks.push(promise),
    });

    await expect(tasks[0]).resolves.toBeUndefined();
    expect(stale.status).toBe("stale");
    expect(stale.calendar?.text).toBe(calendarExport.text);
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
});
