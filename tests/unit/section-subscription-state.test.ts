import { beforeEach, describe, expect, it, vi } from "vitest";

const { userFindUniqueMock, withUserDbContextMock } = vi.hoisted(() => {
  const userFindUnique = vi.fn();
  return {
    userFindUniqueMock: userFindUnique,
    withUserDbContextMock: vi.fn(async (_userId, action) =>
      action({ user: { findUnique: userFindUnique } }),
    ),
  };
});

vi.mock("@/lib/db/prisma", () => ({
  prisma: {},
  withUserDbContext: withUserDbContextMock,
}));

describe("section subscription state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userFindUniqueMock.mockResolvedValue({
      calendarFeedToken: "calendar-token",
      id: "user-1",
      sectionSubscriptions: [{ sectionId: 42 }],
    });
  });

  it("loads only the current section subscription", async () => {
    const { getUserSectionSubscriptionStateForSection } = await import(
      "@/features/subscriptions/server/subscription-calendar-read-model"
    );

    const result = await getUserSectionSubscriptionStateForSection(
      "user-1",
      301,
    );

    expect(withUserDbContextMock).toHaveBeenCalledWith(
      "user-1",
      expect.any(Function),
    );
    expect(userFindUniqueMock).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: {
        id: true,
        calendarFeedToken: true,
        sectionSubscriptions: {
          where: { section: { jwId: 301 } },
          select: { sectionId: true },
          take: 1,
        },
      },
    });
    expect(result).toEqual({
      isSubscribed: true,
      subscriptionIcsUrl: "/api/calendar-feeds/user-1:calendar-token.ics",
      userId: "user-1",
    });
  });

  it("returns an unsubscribed state when the current section is absent", async () => {
    userFindUniqueMock.mockResolvedValue({
      calendarFeedToken: "calendar-token",
      id: "user-1",
      sectionSubscriptions: [],
    });
    const { getUserSectionSubscriptionStateForSection } = await import(
      "@/features/subscriptions/server/subscription-calendar-read-model"
    );

    await expect(
      getUserSectionSubscriptionStateForSection("user-1", 301),
    ).resolves.toMatchObject({ isSubscribed: false });
  });

  it("returns null when the user no longer exists", async () => {
    userFindUniqueMock.mockResolvedValue(null);
    const { getUserSectionSubscriptionStateForSection } = await import(
      "@/features/subscriptions/server/subscription-calendar-read-model"
    );

    await expect(
      getUserSectionSubscriptionStateForSection("user-1", 301),
    ).resolves.toBeNull();
  });
});
