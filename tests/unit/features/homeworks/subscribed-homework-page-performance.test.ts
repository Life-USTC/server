import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany, count, getKinds, localizedContext } = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
  getKinds: vi.fn(),
  localizedContext: vi.fn(async (_locale, _userId, action) => action()),
}));
vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({ homework: { findMany, count } }),
  withLocalizedUserDbContext: localizedContext,
}));
vi.mock("@/features/subscriptions/server/subscription-kind", () => ({
  getUserSubscriptionKinds: getKinds,
}));

describe("subscribed homework page read", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(localizedContext).toHaveBeenCalledExactlyOnceWith(
      "en-us",
      "user-1",
      expect.any(Function),
    );
    expect(findMany).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
        include: expect.objectContaining({
          createdBy: expect.any(Object),
          updatedBy: expect.any(Object),
          deletedBy: expect.any(Object),
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
    expect(result).toEqual({
      data: [
        {
          id: "homework-page",
          sectionId: 7,
          title: "Page-local homework",
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
  });
});
