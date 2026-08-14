import { beforeEach, describe, expect, test, vi } from "vitest";

const { findManyMock, queryRawMock, withUserDbContextMock } = vi.hoisted(() => {
  const findMany = vi.fn();
  const queryRaw = vi.fn();
  const tx = {
    $queryRaw: queryRaw,
    semester: { findMany },
  };
  return {
    findManyMock: findMany,
    queryRawMock: queryRaw,
    withUserDbContextMock: vi.fn(
      async (_userId: string, action: (transaction: typeof tx) => unknown) =>
        action(tx),
    ),
  };
});

vi.mock("@/lib/db/prisma", () => ({
  withUserDbContext: withUserDbContextMock,
}));

describe("workspace navigation summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findManyMock.mockResolvedValue([
      {
        id: 21,
        startDate: new Date("2026-08-01T00:00:00.000Z"),
        endDate: new Date("2026-12-31T00:00:00.000Z"),
      },
    ]);
    queryRawMock.mockResolvedValue([
      {
        calendar_items_count: 12n,
        exams_count: 2n,
        pending_homeworks_count: 3n,
        pending_todos_count: 4n,
        subscribed_section_count: 5n,
      },
    ]);
  });

  test("loads all sidebar counts in one RLS context and one aggregate query", async () => {
    const { getWorkspaceNavigationSummary } = await import(
      "@/features/dashboard/server/workspace-navigation-summary"
    );

    await expect(
      getWorkspaceNavigationSummary(
        "user-1",
        new Date("2026-08-14T04:00:00.000Z"),
      ),
    ).resolves.toEqual({
      userId: "user-1",
      calendarItemsCount: 12,
      examsCount: 2,
      pendingHomeworksCount: 3,
      pendingTodosCount: 4,
      subscribedSectionCount: 5,
    });

    expect(withUserDbContextMock).toHaveBeenCalledOnce();
    expect(withUserDbContextMock).toHaveBeenCalledWith(
      "user-1",
      expect.any(Function),
    );
    expect(findManyMock).toHaveBeenCalledOnce();
    expect(queryRawMock).toHaveBeenCalledOnce();
    expect(findManyMock.mock.invocationCallOrder[0]).toBeLessThan(
      queryRawMock.mock.invocationCallOrder[0],
    );

    const sql = (queryRawMock.mock.calls[0]?.[0] as TemplateStringsArray).join(
      "?",
    );
    expect(sql).toContain('FROM "UserSectionSubscription"');
    expect(sql).toContain('FROM "HomeworkCompletion"');
    expect(sql).toContain('FROM "Todo"');
    expect(sql).toContain('FROM "Exam"');
    expect(sql).not.toContain("calendarFeedToken");
  });

  test("fails closed when the aggregate query unexpectedly returns no row", async () => {
    queryRawMock.mockResolvedValue([]);
    const { getWorkspaceNavigationSummary } = await import(
      "@/features/dashboard/server/workspace-navigation-summary"
    );

    await expect(getWorkspaceNavigationSummary("user-1")).rejects.toThrow(
      "Workspace navigation summary query returned no row",
    );
  });
});
