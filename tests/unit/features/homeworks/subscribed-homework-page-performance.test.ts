import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  completionFindManyMock,
  homeworkCountMock,
  homeworkFindManyMock,
  localizedHomeworkFindManyMock,
  withHomeworkItemStateMock,
  withUserDbContextMock,
} = vi.hoisted(() => ({
  completionFindManyMock: vi.fn(),
  homeworkCountMock: vi.fn(),
  homeworkFindManyMock: vi.fn(),
  localizedHomeworkFindManyMock: vi.fn(),
  withHomeworkItemStateMock: vi.fn(),
  withUserDbContextMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: vi.fn(() => ({
    homework: { findMany: localizedHomeworkFindManyMock },
  })),
  withUserDbContext: withUserDbContextMock,
}));

vi.mock("@/features/homeworks/server/homework-item-state", () => ({
  withHomeworkItemState: withHomeworkItemStateMock,
}));

describe("subscribed homework page read phases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    homeworkFindManyMock.mockResolvedValue([{ id: "homework-page" }]);
    homeworkCountMock.mockResolvedValue(200);
    completionFindManyMock.mockResolvedValue([
      {
        completedAt: new Date("2026-08-01T00:00:00.000Z"),
        homeworkId: "homework-page",
      },
    ]);
    localizedHomeworkFindManyMock.mockResolvedValue([
      { id: "homework-page", title: "Page-local homework" },
    ]);
    withHomeworkItemStateMock.mockImplementation(
      async (
        homeworks: Array<{
          homeworkCompletions?: Array<{ completedAt: Date }>;
          id: string;
        }>,
      ) =>
        homeworks.map(({ homeworkCompletions, ...homework }) => ({
          ...homework,
          commentCount: 2,
          completion: homeworkCompletions?.[0] ?? null,
        })),
    );
    withUserDbContextMock.mockImplementation(async (_userId, action) =>
      action({
        homework: {
          count: homeworkCountMock,
          findMany: homeworkFindManyMock,
        },
        homeworkCompletion: { findMany: completionFindManyMock },
      }),
    );
  });

  it("loads IDs, completion, localized rows, and comments only for one bounded page", async () => {
    const { listSubscribedHomeworkPage } = await import(
      "@/features/subscriptions/server/subscription-homework-page"
    );

    const result = await listSubscribedHomeworkPage("user-1", {
      includeEditors: true,
      locale: "en-us",
      pagination: { page: 2, pageSize: 10 },
    });

    expect(homeworkFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { id: true },
        skip: 10,
        take: 10,
      }),
    );
    expect(homeworkCountMock).toHaveBeenCalledOnce();
    expect(completionFindManyMock).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        homeworkId: { in: ["homework-page"] },
      },
      select: { homeworkId: true, completedAt: true },
    });
    expect(localizedHomeworkFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["homework-page"] } },
        include: expect.objectContaining({
          createdBy: expect.any(Object),
          updatedBy: expect.any(Object),
          deletedBy: expect.any(Object),
        }),
      }),
    );
    expect(withHomeworkItemStateMock).toHaveBeenCalledWith(
      [expect.objectContaining({ id: "homework-page" })],
      "user-1",
    );
    expect(result).toMatchObject({
      data: [
        expect.objectContaining({
          id: "homework-page",
          commentCount: 2,
          completion: {
            completedAt: new Date("2026-08-01T00:00:00.000Z"),
          },
        }),
      ],
      pagination: { page: 2, pageSize: 10, total: 200, totalPages: 20 },
    });
  });
});
