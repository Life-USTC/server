import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  tx: {
    $queryRaw: vi.fn(),
    userYoungEventSubscription: { findMany: vi.fn(), update: vi.fn() },
    youngNotification: {
      deleteMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
  },
  invalidate: vi.fn(),
}));
vi.mock("@/lib/db/prisma", () => ({
  withUserDbContext: async (_id: string, run: (tx: unknown) => unknown) =>
    run(mocks.tx),
}));
vi.mock("@/features/calendar/server/calendar-export-invalidation", () => ({
  scheduleInvalidateUserCalendarExportCache: mocks.invalidate,
}));

import {
  countUnreadYoungNotifications,
  listYoungNotifications,
  readYoungNotification,
  refreshYoungNotifications,
} from "@/features/young/server/young-notification-service";
import { youngEventState } from "@/features/young/server/young-notification-state";

const now = new Date("2035-09-15T10:00:00+08:00");
const event = {
  youngId: "42",
  name: "Workshop",
  location: "East",
  signupStatusCode: null,
  status: null,
  sourceMissing: false,
  startAt: new Date("2035-09-15T10:30:00+08:00"),
  endAt: new Date("2035-09-15T12:00:00+08:00"),
  applyStartAt: null,
  applyEndAt: null,
  isActive: true,
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.tx.userYoungEventSubscription.findMany.mockResolvedValue([]);
  mocks.tx.$queryRaw.mockResolvedValue([]);
});
describe("Young notification refresh and inbox", () => {
  it("counts only the owner's unread, unexpired reminders without refreshing", async () => {
    mocks.tx.youngNotification.count.mockResolvedValue(7);
    expect(await countUnreadYoungNotifications("owner", now)).toBe(7);
    expect(mocks.tx.youngNotification.count).toHaveBeenCalledWith({
      where: {
        userId: "owner",
        readAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    });
    expect(mocks.tx.userYoungEventSubscription.findMany).not.toHaveBeenCalled();
    expect(mocks.tx.youngNotification.create).not.toHaveBeenCalled();
    expect(mocks.tx.youngNotification.createMany).not.toHaveBeenCalled();
  });
  it("deduplicates reminders by subscription lifecycle and timestamp without invalidating unchanged calendars", async () => {
    mocks.tx.userYoungEventSubscription.findMany.mockResolvedValue([
      {
        id: "sub",
        event,
        observedState: youngEventState(event),
        createdAt: new Date("2035-09-01"),
        remindStart: true,
        remindDeadline: false,
        remindSignup: false,
      },
    ]);
    await refreshYoungNotifications("owner", now);
    expect(mocks.tx.youngNotification.createMany).toHaveBeenCalledOnce();
    expect(mocks.tx.youngNotification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: "owner",
          youngId: "42",
          kind: "event_start",
          dedupeKey: `sub:event_start:${event.startAt.toISOString()}`,
          expiresAt: event.startAt,
        }),
      ],
      skipDuplicates: true,
    });
    expect(mocks.invalidate).not.toHaveBeenCalled();
  });
  it("revises changed events, cleans obsolete reminders, and marks missing sources as uncertain", async () => {
    mocks.tx.userYoungEventSubscription.update.mockResolvedValue({
      observedRevision: 2,
    });
    for (const sourceMissing of [false, true]) {
      mocks.tx.userYoungEventSubscription.findMany.mockResolvedValue([
        {
          id: "sub",
          event: { ...event, sourceMissing },
          observedState: "old",
          createdAt: new Date("2035-09-01"),
          remindStart: false,
          remindDeadline: false,
          remindSignup: false,
        },
      ]);
      await refreshYoungNotifications("owner", now);
      expect(mocks.tx.youngNotification.create).toHaveBeenLastCalledWith({
        data: expect.objectContaining({
          kind: "event_changed",
          dedupeKey: "sub:change:2",
          body: expect.stringContaining(
            sourceMissing ? "Source unavailable" : "Event details changed",
          ),
        }),
      });
    }
    expect(mocks.invalidate).toHaveBeenCalledWith("owner");
    expect(mocks.tx.youngNotification.deleteMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        userId: "owner",
        youngId: "42",
        readAt: null,
        dedupeKey: { notIn: [] },
      }),
    });
  });
  it("reads digests for all followed organizers in one query after locking the user", async () => {
    const names = Array.from({ length: 10 }, (_, index) => `Event ${index}`);
    mocks.tx.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([
      { organizerId: "club", title: "Club", total: 11n, names },
      { organizerId: "other", title: "Other", total: 1n, names: ["Workshop"] },
    ]);
    await refreshYoungNotifications("owner", now);
    expect(mocks.tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(mocks.tx.$queryRaw.mock.calls[1].slice(1)).toEqual([
      "owner",
      new Date("2035-09-14T00:00:00+08:00"),
      new Date("2035-09-15T00:00:00+08:00"),
      now,
    ]);
    expect(mocks.tx.youngNotification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          organizerId: "club",
          title: "Club",
          body: `11 个新活动 / new events: ${names.join(" · ")} …`,
          dedupeKey: "organizer:club:2035-09-13T16:00:00.000Z",
        }),
        expect.objectContaining({
          organizerId: "other",
          title: "Other",
          body: "1 个新活动 / new events: Workshop",
        }),
      ],
      skipDuplicates: true,
    });
  });
  it("paginates unexpired notifications and writes read state only for the owner", async () => {
    mocks.tx.youngNotification.count.mockResolvedValue(21);
    mocks.tx.youngNotification.findMany.mockResolvedValue([{ id: "n" }]);
    const inbox = await listYoungNotifications(
      "owner",
      { page: 2, unread: true },
      now,
    );
    expect(inbox.pagination).toEqual({
      page: 2,
      pageSize: 20,
      total: 21,
      totalPages: 2,
    });
    expect(mocks.tx.youngNotification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "owner",
          readAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      }),
    );
    await listYoungNotifications("owner", {}, now);
    mocks.tx.youngNotification.findFirst.mockResolvedValue(null);
    expect(await readYoungNotification("other", "n")).toEqual({
      id: "n",
      success: false,
    });
    expect(mocks.tx.youngNotification.updateMany).not.toHaveBeenCalled();
    mocks.tx.youngNotification.findFirst.mockResolvedValue({ readAt: null });
    expect(await readYoungNotification("owner", "n")).toEqual({
      id: "n",
      success: true,
    });
    expect(mocks.tx.youngNotification.updateMany).toHaveBeenCalledWith({
      where: { id: "n", userId: "owner", readAt: null },
      data: { readAt: expect.any(Date) },
    });
  });
});
