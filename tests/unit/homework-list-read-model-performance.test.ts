import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDeferred } from "../shared/deferred";

const {
  auditFindManyMock,
  completionFindManyMock,
  getViewerContextMock,
  homeworkFindManyMock,
  withUserDbContextMock,
} = vi.hoisted(() => ({
  auditFindManyMock: vi.fn(),
  completionFindManyMock: vi.fn(),
  getViewerContextMock: vi.fn(),
  homeworkFindManyMock: vi.fn(),
  withUserDbContextMock: vi.fn(),
}));

vi.mock("@/lib/auth/viewer-context", () => ({
  getViewerContext: getViewerContextMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: vi.fn(() => ({
    homework: { findMany: homeworkFindManyMock },
  })),
  prisma: {
    homeworkAuditLog: { findMany: auditFindManyMock },
  },
  withUserDbContext: withUserDbContextMock,
}));

import {
  listSectionHomeworkItems,
  listSectionHomeworksWithAudit,
} from "@/features/homeworks/server/homework-list-read-model";

const viewer = {
  image: null,
  isAdmin: false,
  isAuthenticated: true,
  isSuspended: false,
  name: "Viewer",
  suspensionExpiresAt: null,
  suspensionReason: null,
  userId: "viewer-1",
};

describe("section homework list read phases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    homeworkFindManyMock.mockResolvedValue([
      { id: "homework-1", title: "Homework", _count: { comments: 2 } },
    ]);
    completionFindManyMock.mockResolvedValue([
      {
        completedAt: new Date("2026-08-01T00:00:00.000Z"),
        homeworkId: "homework-1",
      },
    ]);
    auditFindManyMock.mockResolvedValue([]);
    getViewerContextMock.mockResolvedValue(viewer);
    withUserDbContextMock.mockImplementation((_userId, action) =>
      action({
        homeworkCompletion: { findMany: completionFindManyMock },
      }),
    );
  });

  it("loads localized rows alongside completions in one RLS transaction", async () => {
    const result = await listSectionHomeworkItems({
      locale: "en-us",
      sectionIds: [7],
      viewerUserId: viewer.userId,
    });

    expect(withUserDbContextMock).toHaveBeenCalledOnce();
    expect(withUserDbContextMock).toHaveBeenCalledWith(
      viewer.userId,
      expect.any(Function),
    );
    expect(homeworkFindManyMock).toHaveBeenCalledOnce();
    expect(completionFindManyMock).toHaveBeenCalledOnce();
    expect(completionFindManyMock).toHaveBeenCalledWith({
      where: {
        userId: viewer.userId,
        homework: { sectionId: 7, deletedAt: null },
      },
      select: { homeworkId: true, completedAt: true },
    });
    expect(result).toEqual([
      expect.objectContaining({
        id: "homework-1",
        commentCount: 2,
        completion: {
          completedAt: new Date("2026-08-01T00:00:00.000Z"),
        },
      }),
    ]);
  });

  it("starts viewer, homework, and audit reads in the same response phase", async () => {
    const viewerDeferred = createDeferred<typeof viewer>();
    getViewerContextMock.mockReturnValueOnce(viewerDeferred.promise);

    const resultPromise = listSectionHomeworksWithAudit({
      locale: "zh-cn",
      sectionIds: [7],
      userId: viewer.userId,
    });
    await Promise.resolve();

    expect(getViewerContextMock).toHaveBeenCalledOnce();
    expect(homeworkFindManyMock).toHaveBeenCalledOnce();
    expect(completionFindManyMock).toHaveBeenCalledOnce();
    expect(auditFindManyMock).toHaveBeenCalledOnce();

    viewerDeferred.resolve(viewer);
    await expect(resultPromise).resolves.toMatchObject({
      viewer,
      auditLogs: [],
      homeworks: [expect.objectContaining({ id: "homework-1" })],
    });
  });

  it("keeps anonymous lists outside an RLS transaction", async () => {
    const result = await listSectionHomeworkItems({
      sectionIds: [7],
      viewerUserId: null,
    });

    expect(withUserDbContextMock).not.toHaveBeenCalled();
    expect(completionFindManyMock).not.toHaveBeenCalled();
    expect(result[0]).toMatchObject({ completion: null });
  });
});
