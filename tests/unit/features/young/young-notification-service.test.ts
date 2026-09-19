import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  tx: {
    $queryRaw: vi.fn(),
    userYoungEventSubscription: { findMany: vi.fn(), update: vi.fn() },
    userYoungOrganizerSubscription: { findMany: vi.fn() },
    youngEvent: { count: vi.fn(), findMany: vi.fn() },
    youngNotification: {
      deleteMany: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
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
  mocks.tx.userYoungOrganizerSubscription.findMany.mockResolvedValue([]);
});
describe("Young notification refresh and inbox", () => {
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
    expect(mocks.tx.youngNotification.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          userId: "owner",
          youngId: "42",
          kind: "event_start",
          dedupeKey: `sub:event_start:${event.startAt.toISOString()}`,
          expiresAt: event.startAt,
        }),
      }),
    );
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
  it("uses completed Shanghai days for organizer digests and skips brand-new follows or empty organizers", async () => {
    mocks.tx.userYoungOrganizerSubscription.findMany.mockResolvedValue([
      { organizerId: "new", organizer: { name: "New" }, createdAt: now },
      {
        organizerId: "empty",
        organizer: { name: "Empty" },
        createdAt: new Date("2035-09-01"),
      },
      {
        organizerId: "club",
        organizer: { name: "Club" },
        createdAt: new Date("2035-09-14T12:00:00+08:00"),
      },
    ]);
    mocks.tx.youngEvent.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(11);
    mocks.tx.youngEvent.findMany.mockResolvedValue([{ name: "A" }]);
    await refreshYoungNotifications("owner", now);
    expect(mocks.tx.youngNotification.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.tx.youngNotification.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          organizerId: "club",
          kind: "organizer_digest",
          body: "11 个新活动 / new events: A …",
          dedupeKey: "organizer:club:2035-09-13T16:00:00.000Z",
        }),
      }),
    );
    expect(mocks.tx.youngEvent.count).toHaveBeenLastCalledWith({
      where: expect.objectContaining({
        createdAt: {
          gt: new Date("2035-09-14T12:00:00+08:00"),
          lt: new Date("2035-09-15T00:00:00+08:00"),
        },
        sourceMissing: false,
      }),
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
