import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany, count, getKinds, userContext, displayFindMany, context } =
  vi.hoisted(() => ({
    context: { active: false },
    findMany: vi.fn(),
    displayFindMany: vi.fn(),
    count: vi.fn(),
    getKinds: vi.fn(),
    userContext: vi.fn(),
  }));
vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({
    homework: { findMany: context.active ? findMany : displayFindMany, count },
  }),
  withUserDbContext: userContext,
}));
vi.mock("@/features/subscriptions/server/subscription-kind", () => ({
  getUserSubscriptionKinds: getKinds,
}));

describe("subscribed homework page read", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    context.active = false;
    userContext.mockImplementation(async (_userId, action) => {
      context.active = true;
      try {
        return await action({ homework: { findMany, count } });
      } finally {
        context.active = false;
      }
    });
    displayFindMany.mockImplementation(async () => {
      expect(context.active).toBe(false);
      return [{ id: "homework-page", section: { course: { name: "Course" } } }];
    });
    findMany.mockResolvedValue([
      {
        id: "homework-page",
        sectionId: 7,
        title: "Page-local homework",
        _count: { comments: 2 },
        homeworkCompletions: [
          { completedAt: new Date("2026-08-01T00:00:00.000Z") },
        ],
      },
    ]);
    count.mockResolvedValue(200);
    getKinds.mockResolvedValue(new Map([[7, "teaching_assistant"]]));
  });

  it("loads a bounded localized page with viewer state in one RLS context", async () => {
    const { listSubscribedHomeworkPage } = await import(
      "@/features/subscriptions/server/subscription-homework-page"
    );
    const result = await listSubscribedHomeworkPage("user-1", {
      includeEditors: true,
      locale: "en-us",
      pagination: { page: 2, pageSize: 10 },
    });
    expect(userContext).toHaveBeenCalledExactlyOnceWith(
      "user-1",
      expect.any(Function),
    );
    expect(findMany).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
        include: expect.objectContaining({
          homeworkCompletions: {
            where: { userId: "user-1" },
            select: { completedAt: true },
          },
          _count: {
            select: { comments: { where: { status: { not: "deleted" } } } },
          },
        }),
      }),
    );
    expect(count).toHaveBeenCalledOnce();
    expect(findMany.mock.calls[0][0].include).not.toHaveProperty("section");
    expect(displayFindMany).toHaveBeenCalledExactlyOnceWith({
      where: { id: { in: ["homework-page"] } },
      select: expect.objectContaining({
        id: true,
        section: expect.any(Object),
        createdBy: expect.any(Object),
      }),
    });
    expect(result).toEqual({
      data: [
        {
          id: "homework-page",
          sectionId: 7,
          title: "Page-local homework",
          section: { course: { name: "Course" } },
          completionRequired: false,
          commentCount: 2,
          completion: { completedAt: new Date("2026-08-01T00:00:00.000Z") },
        },
      ],
      pagination: { page: 2, pageSize: 10, total: 200, totalPages: 20 },
    });
  });

  it("keeps the total but skips subscription decoration for an empty page", async () => {
    findMany.mockResolvedValue([]);
    const { listSubscribedHomeworkPage } = await import(
      "@/features/subscriptions/server/subscription-homework-page"
    );
    const result = await listSubscribedHomeworkPage("user-1", {
      pagination: { page: 30, pageSize: 10 },
    });
    expect(result.data).toEqual([]);
    expect(result.pagination.total).toBe(200);
    expect(getKinds).not.toHaveBeenCalled();
    expect(displayFindMany).not.toHaveBeenCalled();
  });
});
