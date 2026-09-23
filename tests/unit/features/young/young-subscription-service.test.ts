import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const model = () => ({
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    upsert: vi.fn(),
    deleteMany: vi.fn(),
  });
  return {
    tx: {
      $queryRaw: vi.fn(),
      youngEvent: model(),
      youngOrganizer: model(),
      youngNotification: model(),
      userYoungEventSubscription: model(),
      userYoungOrganizerSubscription: model(),
    },
    invalidate: vi.fn(),
    owner: vi.fn(),
  };
});
vi.mock("@/lib/db/prisma", () => ({ withUserDbContext: mocks.owner }));
vi.mock("@/features/calendar/server/calendar-export-invalidation", () => ({
  scheduleInvalidateUserCalendarExportCache: mocks.invalidate,
}));

import {
  getYoungEventSubscription,
  getYoungOrganizerSubscription,
  listYoungEventSubscriptions,
  listYoungOrganizerSubscriptions,
  setYoungEventSubscription,
  setYoungOrganizerSubscription,
} from "@/features/young/server/young-subscription-service";

const event = {
  youngId: "42",
  name: "Run",
  category: null,
  department: null,
  organizer: null,
  organizerId: null,
  signupStatusCode: null,
  status: null,
  location: "East",
  imageUrl: null,
  hours: null,
  capacity: null,
  appliedCount: null,
  startAt: new Date("2035-09-15T10:00:00+08:00"),
  endAt: null,
  applyStartAt: null,
  applyEndAt: null,
  isActive: true,
  sourceMissing: false,
  lastSeenAt: null,
  createdAt: new Date("2035-09-01T00:00:00Z"),
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.owner.mockImplementation(
    async (_id: string, run: (tx: typeof mocks.tx) => unknown) => run(mocks.tx),
  );
  mocks.tx.youngEvent.findUnique.mockResolvedValue(event);
  mocks.tx.youngOrganizer.findUnique.mockResolvedValue({ id: "club" });
});
describe("Young subscription state transitions", () => {
  it("uses reminder defaults only for absent subscription state", async () => {
    mocks.tx.userYoungEventSubscription.findUnique.mockResolvedValue(null);
    expect(await getYoungEventSubscription("u", "42")).toEqual({
      youngId: "42",
      subscribed: false,
      remindSignup: true,
      remindDeadline: true,
      remindStart: true,
    });
    mocks.tx.userYoungEventSubscription.findUnique.mockResolvedValue({
      remindSignup: false,
      remindDeadline: false,
      remindStart: true,
    });
    expect(await getYoungEventSubscription("u", "42")).toMatchObject({
      subscribed: true,
      remindSignup: false,
      remindDeadline: false,
      remindStart: true,
    });
    expect(mocks.owner).toHaveBeenCalledWith("u", expect.any(Function));
  });
  it("removes unread reminders for disabled settings and invalidates calendar exports", async () => {
    mocks.tx.userYoungEventSubscription.upsert.mockResolvedValue({
      remindSignup: false,
      remindDeadline: false,
      remindStart: false,
    });
    const state = await setYoungEventSubscription("u", "42", true, {
      remindSignup: false,
      remindDeadline: false,
      remindStart: false,
    });
    expect(state).toMatchObject({ subscribed: true, remindStart: false });
    expect(mocks.tx.youngNotification.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: "u",
        youngId: "42",
        readAt: null,
        kind: { in: ["signup_open", "signup_deadline", "event_start"] },
      },
    });
    expect(mocks.invalidate).toHaveBeenCalledWith("u");
    expect(mocks.tx.$queryRaw).toHaveBeenCalledBefore(
      mocks.tx.userYoungEventSubscription.upsert,
    );
  });
  it("keeps notifications when all reminder settings remain enabled", async () => {
    mocks.tx.userYoungEventSubscription.upsert.mockResolvedValue({
      remindSignup: true,
      remindDeadline: true,
      remindStart: true,
    });
    await setYoungEventSubscription("u", "42", true);
    expect(mocks.tx.youngNotification.deleteMany).not.toHaveBeenCalled();
  });
  it("unsubscribes without deleting read notification history", async () => {
    expect(await setYoungEventSubscription("u", "42", false)).toMatchObject({
      subscribed: false,
      remindSignup: false,
      remindDeadline: false,
      remindStart: false,
    });
    expect(mocks.tx.userYoungEventSubscription.deleteMany).toHaveBeenCalledWith(
      { where: { userId: "u", youngId: "42" } },
    );
    expect(mocks.tx.youngNotification.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u", youngId: "42", readAt: null },
    });
    expect(mocks.invalidate).toHaveBeenCalledWith("u");
  });
  it("rejects unknown targets without writing subscriptions or invalidating exports", async () => {
    mocks.tx.youngEvent.findUnique.mockResolvedValue(null);
    mocks.tx.youngOrganizer.findUnique.mockResolvedValue(null);
    await expect(
      setYoungEventSubscription("u", "missing", true),
    ).rejects.toThrow("Unknown Young event");
    await expect(
      setYoungOrganizerSubscription("u", "missing", true),
    ).rejects.toThrow("Unknown Young organizer");
    expect(mocks.tx.userYoungEventSubscription.upsert).not.toHaveBeenCalled();
    expect(
      mocks.tx.userYoungOrganizerSubscription.upsert,
    ).not.toHaveBeenCalled();
    expect(mocks.invalidate).not.toHaveBeenCalled();
  });
  it("follows organizers without creating event subscriptions", async () => {
    expect(await setYoungOrganizerSubscription("u", "club", true)).toEqual({
      organizerId: "club",
      subscribed: true,
    });
    expect(mocks.tx.userYoungEventSubscription.upsert).not.toHaveBeenCalled();
    expect(mocks.invalidate).not.toHaveBeenCalled();
    mocks.tx.userYoungOrganizerSubscription.findUnique.mockResolvedValue({
      organizerId: "club",
    });
    expect(await getYoungOrganizerSubscription("u", "club")).toEqual({
      organizerId: "club",
      subscribed: true,
    });
    mocks.tx.userYoungOrganizerSubscription.findUnique.mockResolvedValue(null);
    expect(await getYoungOrganizerSubscription("u", "club")).toEqual({
      organizerId: "club",
      subscribed: false,
    });
    expect(await setYoungOrganizerSubscription("u", "club", false)).toEqual({
      organizerId: "club",
      subscribed: false,
    });
    expect(mocks.tx.youngNotification.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u", organizerId: "club", readAt: null },
    });
  });
  it("paginates owner subscriptions and serializes public event times in Shanghai", async () => {
    mocks.tx.userYoungEventSubscription.count.mockResolvedValue(21);
    mocks.tx.userYoungEventSubscription.findMany.mockResolvedValue([
      {
        youngId: "42",
        event,
        createdAt: event.createdAt,
        remindSignup: true,
        remindDeadline: false,
        remindStart: true,
      },
    ]);
    const result = await listYoungEventSubscriptions("u", {
      page: 2,
      pageSize: 20,
    });
    expect(result.pagination).toEqual({
      page: 2,
      pageSize: 20,
      total: 21,
      totalPages: 2,
    });
    expect(result.data[0]).toMatchObject({
      youngId: "42",
      remindDeadline: false,
      event: { startAt: "2035-09-15T10:00:00+08:00" },
    });
    expect(mocks.tx.userYoungEventSubscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u" }, skip: 20, take: 20 }),
    );
    mocks.tx.userYoungOrganizerSubscription.count.mockResolvedValue(1);
    mocks.tx.userYoungOrganizerSubscription.findMany.mockResolvedValue([
      {
        organizerId: "club",
        organizer: { id: "club", name: "Club" },
        createdAt: event.createdAt,
      },
    ]);
    const follows = await listYoungOrganizerSubscriptions("u");
    expect(follows.data).toHaveLength(1);
    expect(follows.data[0].organizer.name).toBe("Club");
  });
});
