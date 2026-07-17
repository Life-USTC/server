import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  buildSuggestionsMock,
  getLatestCommentsMock,
  sectionFindFirstMock,
  sectionFindManyMock,
  semesterMock,
} = vi.hoisted(() => ({
  buildSuggestionsMock: vi.fn().mockResolvedValue({}),
  getLatestCommentsMock: vi.fn().mockResolvedValue([]),
  sectionFindFirstMock: vi.fn(),
  sectionFindManyMock: vi.fn().mockResolvedValue([]),
  semesterMock: {
    code: "2026-spring",
    id: 44,
    nameCn: "2026年春季学期",
  },
}));

vi.mock("@/features/catalog/server/section-code-match-semester", () => ({
  resolveSectionCodeMatchSemester: vi.fn().mockResolvedValue(semesterMock),
}));

vi.mock("@/features/catalog/server/section-code-match-suggestions", () => ({
  buildSectionCodeSuggestions: buildSuggestionsMock,
}));

vi.mock("@/features/comments/server/latest-comments", () => ({
  getLatestComments: getLatestCommentsMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({
    section: { findMany: sectionFindManyMock },
  }),
  prisma: {
    section: {
      findFirst: sectionFindFirstMock,
      findMany: sectionFindManyMock,
    },
  },
}));

describe("retired Section discovery boundaries", () => {
  beforeEach(() => {
    sectionFindFirstMock.mockReset().mockResolvedValue(null);
    sectionFindManyMock.mockReset().mockResolvedValue([]);
    buildSuggestionsMock.mockClear();
    getLatestCommentsMock.mockReset().mockResolvedValue([]);
  });

  it("excludes retired rows from public code matching", async () => {
    const { findSectionCodeMatches } = await import(
      "@/features/catalog/server/section-code-match-query"
    );

    await findSectionCodeMatches(["CS100"]);

    expect(sectionFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          code: { in: ["CS100"] },
          retiredAt: null,
          semesterId: semesterMock.id,
        },
      }),
    );
  });

  it("loads retirement state for historical Section detail UI", async () => {
    const { sectionPageSelect } = await import(
      "@/features/section-detail/server/section-page-select"
    );

    expect(sectionPageSelect.retiredAt).toBe(true);
  });

  it("excludes retired rows from public related-Section discovery", async () => {
    const commentCount = vi.fn().mockResolvedValue(0);
    const { getSectionPageRelatedData } = await import(
      "@/features/section-detail/server/section-page-related-data"
    );

    await getSectionPageRelatedData({
      locale: "zh-cn",
      prisma: {
        comment: { count: commentCount },
        section: { findMany: sectionFindManyMock },
      } as never,
      section: {
        courseId: 77,
        id: 11,
        semesterId: 44,
        teachers: [{ id: 5 }],
      },
    });

    expect(sectionFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          courseId: 77,
          id: { not: 11 },
          retiredAt: null,
        },
      }),
    );
  });

  it("counts only active Sections in public teacher results", async () => {
    const { teacherListInclude } = await import(
      "@/features/catalog/server/academic-query-includes"
    );

    expect(teacherListInclude._count.select.sections).toEqual({
      where: { retiredAt: null },
    });
  });

  it("rejects retired rows for add/set resolution but allows removal resolution", async () => {
    const { resolveCalendarSubscriptionSections } = await import(
      "@/features/subscriptions/server/subscription-section-resolver"
    );

    await resolveCalendarSubscriptionSections({ sectionIds: [11] });
    expect(sectionFindManyMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: { in: [11] }, retiredAt: null },
      }),
    );

    await resolveCalendarSubscriptionSections({
      includeRetired: true,
      sectionIds: [11],
    });
    expect(sectionFindManyMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: { in: [11] } },
      }),
    );
  });

  it("requires an active row to subscribe but accepts a retired row to unsubscribe", async () => {
    const { subscribeUserToSectionByJwId, unsubscribeUserFromSectionByJwId } =
      await import("@/features/subscriptions/server/subscription-write-model");

    await subscribeUserToSectionByJwId("user-1", 101);
    expect(sectionFindFirstMock).toHaveBeenLastCalledWith({
      where: { jwId: 101, retiredAt: null },
      select: { id: true },
    });

    await unsubscribeUserFromSectionByJwId("user-1", 102);
    expect(sectionFindFirstMock).toHaveBeenLastCalledWith({
      where: { jwId: 102 },
      select: { id: true },
    });
  });

  it("allows GraphQL removal to resolve a retired subscription", async () => {
    const { setUserSectionSubscriptionByJwId } = await import(
      "@/features/subscriptions/server/subscription-write-model"
    );

    await setUserSectionSubscriptionByJwId({
      sectionJwId: 103,
      subscribed: false,
      userId: "user-1",
    });

    expect(sectionFindFirstMock).toHaveBeenLastCalledWith({
      where: { jwId: 103 },
      select: { id: true },
    });
  });
});
