import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  localizedUserFindUniqueMock,
  sectionFindManyMock,
  sectionFindUniqueMock,
  userFindUniqueMock,
} = vi.hoisted(() => ({
  localizedUserFindUniqueMock: vi.fn(),
  sectionFindManyMock: vi.fn(),
  sectionFindUniqueMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({
    user: { findUnique: localizedUserFindUniqueMock },
  }),
  prisma: {
    section: {
      findMany: sectionFindManyMock,
      findUnique: sectionFindUniqueMock,
    },
    user: { findUnique: userFindUniqueMock },
  },
}));

describe("retired Section query contracts", () => {
  beforeEach(() => {
    sectionFindManyMock.mockReset().mockResolvedValue([]);
    sectionFindUniqueMock.mockReset().mockResolvedValue(null);
    localizedUserFindUniqueMock.mockReset().mockResolvedValue(null);
    userFindUniqueMock.mockReset().mockResolvedValue(null);
  });

  it("excludes retired rows from a multi-section calendar export", async () => {
    const { getSectionsForCalendar } = await import(
      "@/features/calendar/server/calendar-export-data"
    );

    await getSectionsForCalendar([11, 12]);

    expect(sectionFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { in: [11, 12] },
          retiredAt: null,
        },
      }),
    );
  });

  it("keeps direct historical Section calendar access available", async () => {
    const { getSectionForCalendar } = await import(
      "@/features/calendar/server/calendar-export-data"
    );

    await getSectionForCalendar(101);

    expect(sectionFindUniqueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { jwId: 101 },
      }),
    );
  });

  it("excludes retired rows from the generated personal calendar only", async () => {
    const { getUserCalendarRecord } = await import(
      "@/features/calendar/server/calendar-export-data"
    );

    await getUserCalendarRecord("user-1");

    expect(userFindUniqueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          subscribedSections: expect.objectContaining({
            where: { retiredAt: null },
          }),
        }),
      }),
    );
  });

  it("keeps retired rows in the user's owned subscription history", async () => {
    const { getUserCalendarSubscription } = await import(
      "@/features/subscriptions/server/subscription-calendar-read-model"
    );

    await getUserCalendarSubscription("user-1");

    expect(localizedUserFindUniqueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          subscribedSections: expect.not.objectContaining({
            where: expect.anything(),
          }),
        }),
      }),
    );
  });

  it("derives current calendar IDs from active owned subscriptions", async () => {
    const { getActiveSubscribedSectionIds } = await import(
      "@/features/subscriptions/server/subscription-read-model-shared"
    );

    await getActiveSubscribedSectionIds("user-1", [11, 12]);

    expect(userFindUniqueMock).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: {
        subscribedSections: {
          where: {
            id: { in: [11, 12] },
            retiredAt: null,
          },
          select: { id: true },
        },
      },
    });
  });
});
