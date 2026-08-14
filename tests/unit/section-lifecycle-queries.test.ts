import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  localizedUserFindUniqueMock,
  homeworkFindManyMock,
  sectionFindManyMock,
  sectionFindUniqueMock,
  transactionUserFindUniqueMock,
  userFindUniqueMock,
  userSectionSubscriptionFindManyMock,
  withUserDbContextMock,
} = vi.hoisted(() => ({
  localizedUserFindUniqueMock: vi.fn(),
  homeworkFindManyMock: vi.fn(),
  sectionFindManyMock: vi.fn(),
  sectionFindUniqueMock: vi.fn(),
  transactionUserFindUniqueMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
  userSectionSubscriptionFindManyMock: vi.fn(),
  withUserDbContextMock: vi.fn(),
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
    userSectionSubscription: {
      findMany: userSectionSubscriptionFindManyMock,
    },
  },
  withUserDbContext: withUserDbContextMock,
}));

describe("retired Section query contracts", () => {
  beforeEach(() => {
    homeworkFindManyMock.mockReset().mockResolvedValue([]);
    sectionFindManyMock.mockReset().mockResolvedValue([]);
    sectionFindUniqueMock.mockReset().mockResolvedValue(null);
    localizedUserFindUniqueMock.mockReset().mockResolvedValue(null);
    transactionUserFindUniqueMock.mockReset().mockResolvedValue(null);
    userFindUniqueMock.mockReset().mockResolvedValue(null);
    userSectionSubscriptionFindManyMock.mockReset().mockResolvedValue([]);
    withUserDbContextMock.mockReset().mockImplementation((_userId, action) =>
      action({
        homework: { findMany: homeworkFindManyMock },
        user: { findUnique: transactionUserFindUniqueMock },
        userSectionSubscription: {
          findMany: userSectionSubscriptionFindManyMock,
        },
      }),
    );
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

  it("reads incomplete homework calendar items inside owner context", async () => {
    const { getIncompleteHomeworkCalendarItems } = await import(
      "@/features/calendar/server/calendar-export-data"
    );

    await getIncompleteHomeworkCalendarItems("user-1", [11, 12]);

    expect(withUserDbContextMock).toHaveBeenCalledWith(
      "user-1",
      expect.any(Function),
    );
    expect(homeworkFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          homeworkCompletions: { none: { userId: "user-1" } },
        }),
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

    expect(withUserDbContextMock).toHaveBeenCalledWith(
      "user-1",
      expect.any(Function),
    );
    expect(transactionUserFindUniqueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          sectionSubscriptions: expect.objectContaining({
            where: { section: { retiredAt: null } },
          }),
        }),
      }),
    );
    expect(userFindUniqueMock).not.toHaveBeenCalled();
  });

  it("uses a minimal projection for personal calendar access checks", async () => {
    const { getUserCalendarAccessRecord } = await import(
      "@/features/calendar/server/calendar-export-data"
    );

    await getUserCalendarAccessRecord("user-1");

    expect(userFindUniqueMock).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: {
        id: true,
        calendarFeedToken: true,
      },
    });
  });

  it("keeps retired rows in the user's owned subscription history", async () => {
    const { getUserCalendarSubscription } = await import(
      "@/features/subscriptions/server/subscription-calendar-read-model"
    );

    await getUserCalendarSubscription("user-1");

    expect(withUserDbContextMock).toHaveBeenCalledWith(
      "user-1",
      expect.any(Function),
    );
    expect(transactionUserFindUniqueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          sectionSubscriptions: expect.not.objectContaining({
            where: expect.anything(),
          }),
        }),
      }),
    );
    const query = transactionUserFindUniqueMock.mock.calls[0]?.[0];
    const teacherSelect =
      query.select.sectionSubscriptions.include.section.include.teachers.select;
    expect(teacherSelect).toMatchObject({
      id: true,
      nameCn: true,
      nameEn: true,
    });
    expect(teacherSelect).not.toHaveProperty("namePrimary");
    expect(teacherSelect).not.toHaveProperty("nameSecondary");
    expect(localizedUserFindUniqueMock).not.toHaveBeenCalled();
  });

  it("derives current calendar IDs from active owned subscriptions", async () => {
    const { getActiveSubscribedSectionIds } = await import(
      "@/features/subscriptions/server/subscription-read-model-shared"
    );

    await getActiveSubscribedSectionIds("user-1", [11, 12]);

    expect(userSectionSubscriptionFindManyMock).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        section: {
          id: { in: [11, 12] },
          retiredAt: null,
        },
      },
      select: { sectionId: true },
    });
  });
});
