import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getCachedUserCalendarExport,
  requestMatchesEtag,
  resetUserCalendarExportCacheForTest,
} from "@/features/calendar/server/calendar-export-cache";
import { setCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";

const calendarExport = {
  cacheControl: "private, max-age=300",
  filename: "life-ustc-subscriptions.ics",
  text: "BEGIN:VCALENDAR\nEND:VCALENDAR",
};

describe("用户 iCal 导出缓存", () => {
  afterEach(() => {
    resetUserCalendarExportCacheForTest();
    setCloudflareRuntimeEnv(undefined);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("在 TTL 内复用已生成的日历导出", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    const writeDataPoint = vi.fn();
    setCloudflareRuntimeEnv({ ANALYTICS: { writeDataPoint } });
    const buildExport = vi.fn().mockResolvedValue(calendarExport);

    const first = await getCachedUserCalendarExport("user-1", buildExport);
    const second = await getCachedUserCalendarExport("user-1", buildExport);

    expect(first.status).toBe("miss");
    expect(second.status).toBe("hit");
    expect(buildExport).toHaveBeenCalledTimes(1);
    expect(second.calendar?.etag).toMatch(/^"sha256-[A-Za-z0-9_-]+"$/);

    expect(writeDataPoint).toHaveBeenCalledWith({
      indexes: ["cache:calendar:user"],
      blobs: ["calendar_feed_cache", "user", "miss"],
      doubles: [60_000, 1],
    });
    expect(writeDataPoint).toHaveBeenCalledWith({
      indexes: ["cache:calendar:user"],
      blobs: ["calendar_feed_cache", "user", "hit"],
      doubles: [60_000, 1],
    });
    expect(JSON.stringify(writeDataPoint.mock.calls)).not.toContain("user-1");
  });

  it("TTL 过期后重新生成导出", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    const buildExport = vi
      .fn()
      .mockResolvedValueOnce(calendarExport)
      .mockResolvedValueOnce({
        ...calendarExport,
        text: "BEGIN:VCALENDAR\nX-UPDATED:1\nEND:VCALENDAR",
      });

    await getCachedUserCalendarExport("user-1", buildExport);
    vi.setSystemTime(new Date("2026-06-07T00:01:01.000Z"));
    const refreshed = await getCachedUserCalendarExport("user-1", buildExport);

    expect(refreshed.status).toBe("miss");
    expect(refreshed.calendar?.text).toContain("X-UPDATED:1");
    expect(buildExport).toHaveBeenCalledTimes(2);
  });

  it("不缓存空日历结果", async () => {
    const buildExport = vi.fn().mockResolvedValue(null);

    await getCachedUserCalendarExport("user-1", buildExport);
    await getCachedUserCalendarExport("user-1", buildExport);

    expect(buildExport).toHaveBeenCalledTimes(2);
  });

  it("限制缓存条目数量", async () => {
    const buildExport = vi.fn().mockResolvedValue(calendarExport);

    for (let index = 0; index < 101; index += 1) {
      await getCachedUserCalendarExport(`user-${index}`, buildExport);
    }
    await getCachedUserCalendarExport("user-0", buildExport);

    expect(buildExport).toHaveBeenCalledTimes(102);
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
