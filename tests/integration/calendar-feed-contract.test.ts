import { afterAll, afterEach, expect, it, vi } from "vitest";
import * as exportCache from "@/features/calendar/server/calendar-export-cache";
import { getUserCalendarRoute } from "@/lib/api/routes/calendars";
import { prisma as runtimePrisma } from "@/lib/db/prisma";
import { createFixturePrisma } from "../shared/prisma";

vi.mock("@/features/calendar/server/ical-event-utils", async (original) => ({
  ...(await original<
    typeof import("@/features/calendar/server/ical-event-utils")
  >()),
  loadLocationAssets: async () => [
    { locations: [] },
    { manifest: { rooms: [] }, rules: [] },
  ],
}));
const db = createFixturePrisma();
afterEach(() => {
  exportCache.resetUserCalendarExportCacheForTest();
  vi.restoreAllMocks();
});
afterAll(async () => {
  await Promise.all([db.$disconnect(), runtimePrisma.$disconnect()]);
});

async function withFeed(run: (userId: string, token: string) => Promise<void>) {
  const userId = crypto.randomUUID();
  const token = crypto.randomUUID();
  await db.user.create({
    data: {
      id: userId,
      name: "Calendar feed owner",
      email: `${userId}@feed-contract.test`,
      calendarFeedToken: token,
      todos: {
        create: {
          title: `Private calendar item ${userId}`,
          dueAt: new Date("2035-09-20T08:30:00+08:00"),
        },
      },
    },
  });
  try {
    await run(userId, token);
  } finally {
    await db.user.delete({ where: { id: userId } });
  }
}
function read(userId: string, token: string, etag?: string) {
  const credential = `${userId}:${token}`;
  return getUserCalendarRoute(
    new Request(
      `https://example.test/api/calendar-feeds/${encodeURIComponent(credential)}.ics`,
      { headers: etag ? { "If-None-Match": etag } : {} },
    ),
    { userId: credential },
  );
}

it("calendar.feed-auth-before-cache", async () => {
  await withFeed(async (userId, token) => {
    const cacheRead = vi.spyOn(exportCache, "getCachedUserCalendarExport");
    const first = await read(userId, token);
    expect(first.status).toBe(200);
    const etag = first.headers.get("ETag");
    expect(etag).toBeTruthy();
    expect((await first.text()).replace(/\r\n[ \t]/g, "")).toContain(
      `Private calendar item ${userId}`,
    );
    for (const conditional of [etag, `W/${etag}`, `"other", ${etag}`]) {
      const current = await read(userId, token, conditional ?? undefined);
      expect(current.status).toBe(304);
      expect(await current.text()).toBe("");
    }
    expect(cacheRead).toHaveBeenCalledTimes(4);
    await db.user.update({
      where: { id: userId },
      data: { calendarFeedToken: "replacement-token" },
    });
    cacheRead.mockClear();
    const revoked = await read(userId, token, etag ?? undefined);
    expect(revoked.status).toBe(410);
    expect(await revoked.text()).not.toContain(userId);
    expect(cacheRead).not.toHaveBeenCalled();
    const replacement = await read(
      userId,
      "replacement-token",
      etag ?? undefined,
    );
    expect(replacement.status).toBe(304);
    expect(cacheRead).toHaveBeenCalledOnce();
  });
});

it("calendar.personal-feed-http-cache", async () => {
  await withFeed(async (userId, token) => {
    const first = await read(userId, token);
    expect(first.status).toBe(200);
    const etag = first.headers.get("ETag") ?? undefined;
    const conditional = await read(userId, token, etag);
    expect(conditional.status).toBe(304);
    const denied = await read(userId, "wrong-token", etag);
    expect(denied.status).toBe(410);
    for (const response of [first, conditional, denied])
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
});

it("ical.feed-cold-miss", async () => {
  await withFeed(async (userId, token) => {
    exportCache.resetUserCalendarExportCacheForTest();
    const response = await read(userId, token);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "text/calendar; charset=utf-8",
    );
    const text = (await response.text()).replace(/\r\n[ \t]/g, "");
    expect(text).toContain("BEGIN:VCALENDAR");
    expect(text).toContain("BEGIN:VEVENT");
    expect(text).toContain(`Private calendar item ${userId}`);
    expect(response.headers.get("ETag")).toMatch(/^"[^"]+"$/);
  });
});
