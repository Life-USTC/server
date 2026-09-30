import { vi } from "vitest";
import { invalidateUserCalendarExportCache } from "@/features/calendar/server/calendar-export-cache";
import { getUserCalendarRoute } from "@/lib/api/routes/calendars";
import { nodeProtocolTest } from "../shared/node-protocol-fixture";

vi.mock("@/features/calendar/server/ical-event-utils", async (original) => ({
  ...(await original<
    typeof import("@/features/calendar/server/ical-event-utils")
  >()),
  loadLocationAssets: async () => [
    { locations: [] },
    { manifest: { rooms: [] }, rules: [] },
  ],
}));
// Each async request counts its own real cache access. Cases never install or
// restore one another's spy, and the underlying cache implementation still runs.
const cacheReadObservation = await vi.hoisted(async () => {
  const { AsyncLocalStorage } = await import("node:async_hooks");
  return new AsyncLocalStorage<() => void>();
});
vi.mock(
  "@/features/calendar/server/calendar-export-cache",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@/features/calendar/server/calendar-export-cache")
      >();
    return {
      ...actual,
      getCachedUserCalendarExport(
        ...args: Parameters<typeof actual.getCachedUserCalendarExport>
      ) {
        cacheReadObservation.getStore()?.();
        return actual.getCachedUserCalendarExport(...args);
      },
    };
  },
);

const it = nodeProtocolTest.extend(
  "feed",
  async ({ isolatedDatabase: { owner: db }, protocolRuntime }) => {
    const userId = crypto.randomUUID();
    const token = crypto.randomUUID();
    const cacheRead = vi.fn();
    const read = (credentialToken: string, etag?: string) =>
      protocolRuntime.request(() =>
        cacheReadObservation.run(cacheRead, () => {
          const credential = `${userId}:${credentialToken}`;
          return getUserCalendarRoute(
            new Request(
              `https://example.test/api/calendar-feeds/${encodeURIComponent(credential)}.ics`,
              { headers: etag ? { "If-None-Match": etag } : {} },
            ),
            { userId: credential },
          );
        }),
      );
    const run = (work: () => Promise<void>) =>
      protocolRuntime.run(async () => {
        const results = await Promise.allSettled([
          Promise.resolve().then(async () => {
            await db.$transaction((tx) =>
              tx.user.create({
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
              }),
            );
            await work();
          }),
        ]);
        // The admitted workflow owns cleanup even after a test timeout. Evict only
        // this case's UUID; never clear the global cache or another user's rebuild.
        results.push(
          ...(await Promise.allSettled([
            protocolRuntime.request(() =>
              invalidateUserCalendarExportCache(userId),
            ),
          ])),
        );
        const failures = results.flatMap((result) =>
          result.status === "rejected" ? [result.reason] : [],
        );
        if (failures.length === 1) throw failures[0];
        if (failures.length > 1)
          throw new AggregateError(
            failures,
            "Calendar feed and cache cleanup failed",
          );
      });
    return { userId, token, cacheRead, read, run, db };
  },
);

it("calendar.feed-auth-before-cache", async ({ feed, expect }) => {
  await feed.run(async () => {
    const { userId, token, db, cacheRead, read } = feed;
    const first = await read(token);
    expect(first.status).toBe(200);
    const etag = first.headers.get("ETag");
    expect(etag).toBeTruthy();
    expect((await first.text()).replace(/\r\n[ \t]/g, "")).toContain(
      `Private calendar item ${userId}`,
    );
    for (const conditional of [etag, `W/${etag}`, `"other", ${etag}`]) {
      const current = await read(token, conditional ?? undefined);
      expect(current.status).toBe(304);
      expect(await current.text()).toBe("");
    }
    expect(cacheRead).toHaveBeenCalledTimes(4);
    await db.user.update({
      where: { id: userId },
      data: { calendarFeedToken: "replacement-token" },
    });
    cacheRead.mockClear();
    const revoked = await read(token, etag ?? undefined);
    expect(revoked.status).toBe(410);
    expect(await revoked.text()).not.toContain(userId);
    expect(cacheRead).not.toHaveBeenCalled();
    const replacement = await read("replacement-token", etag ?? undefined);
    expect(replacement.status).toBe(304);
    expect(cacheRead).toHaveBeenCalledOnce();
  });
});

it("calendar.personal-feed-http-cache", async ({ feed, expect }) => {
  await feed.run(async () => {
    const { token, read } = feed;
    const first = await read(token);
    expect(first.status).toBe(200);
    const etag = first.headers.get("ETag") ?? undefined;
    const conditional = await read(token, etag);
    expect(conditional.status).toBe(304);
    const denied = await read("wrong-token", etag);
    expect(denied.status).toBe(410);
    for (const response of [first, conditional, denied]) {
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      await response.text();
    }
  });
});

it("ical.feed-cold-miss", async ({ feed, expect }) => {
  await feed.run(async () => {
    // This private UUID has never been requested, so its first request is cold.
    const { userId, token, read } = feed;
    const response = await read(token);
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
