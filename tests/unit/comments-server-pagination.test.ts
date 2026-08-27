import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getViewerContextMock,
  loadCommentThread,
  resolveCommentTarget,
  writeCommentsStageAnalyticsMock,
} = vi.hoisted(() => ({
  getViewerContextMock: vi.fn(),
  loadCommentThread: vi.fn(),
  resolveCommentTarget: vi.fn(),
  writeCommentsStageAnalyticsMock: vi.fn(),
}));

vi.mock("@/lib/auth/viewer-context", () => ({
  getViewerContext: getViewerContextMock,
}));
vi.mock("@/features/comments/server/comment-read-model", () => ({
  loadCommentThread,
}));
vi.mock("@/features/comments/server/comment-utils", () => ({
  resolveCommentTarget,
}));
vi.mock("@/lib/metrics/analytics-engine", () => ({
  writeCommentsStageAnalytics: writeCommentsStageAnalyticsMock,
}));

const viewer = {
  image: null,
  isAdmin: false,
  isAuthenticated: false,
  isSuspended: false,
  name: null,
  suspensionExpiresAt: null,
  suspensionReason: null,
  userId: null,
};

describe("comments SSR payload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getViewerContextMock.mockReset();
    resolveCommentTarget.mockResolvedValue({
      empty: false,
      whereTarget: { courseId: 1 },
    });
    loadCommentThread.mockResolvedValue({
      comments: [],
      hiddenCount: 0,
      total: 21,
      viewer,
    });
    getViewerContextMock.mockResolvedValue(viewer);
    writeCommentsStageAnalyticsMock.mockReset();
  });

  it("loads one bounded root page and marks it for CSR completion", async () => {
    const { getCommentsPayload } = await import(
      "@/features/comments/server/comments-server"
    );

    const result = await getCommentsPayload(
      { targetId: 1, type: "course" },
      viewer,
      { pageSize: 20 },
    );

    expect(loadCommentThread).toHaveBeenCalledWith(
      expect.objectContaining({
        pagination: { pageSize: 20, skip: 0 },
        viewerContextStageRecorded: true,
      }),
    );
    expect(result.complete).toBe(false);
  });

  it("counts two cold authenticated viewer reads in one SSR stage", async () => {
    const authenticatedViewer = {
      ...viewer,
      isAuthenticated: true,
      userId: "user-1",
    };
    getViewerContextMock.mockImplementation(async ({ instrumentation }) => {
      instrumentation?.onQuery?.();
      instrumentation?.onQuery?.();
      return authenticatedViewer;
    });

    const { getCommentsPayload } = await import(
      "@/features/comments/server/comments-server"
    );
    await getCommentsPayload({ targetId: 1, type: "course" });

    expect(getViewerContextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        includeAdmin: false,
        instrumentation: expect.any(Object),
      }),
    );
    expect(writeCommentsStageAnalyticsMock).toHaveBeenCalledOnce();
    expect(writeCommentsStageAnalyticsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dbContext: "none",
        dbQueryCount: 2,
        dbTransactionCount: 0,
        outcome: "success",
        stage: "viewer.context",
      }),
    );
    expect(loadCommentThread).toHaveBeenCalledWith(
      expect.objectContaining({
        viewer: authenticatedViewer,
        viewerContextStageRecorded: true,
      }),
    );
  });

  it("records anonymous and preloaded viewer contexts with zero reads", async () => {
    const { getCommentsPayload } = await import(
      "@/features/comments/server/comments-server"
    );

    await getCommentsPayload({ targetId: 1, type: "course" });
    expect(writeCommentsStageAnalyticsMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        dbQueryCount: 0,
        dbTransactionCount: 0,
        stage: "viewer.context",
      }),
    );

    writeCommentsStageAnalyticsMock.mockReset();
    getViewerContextMock.mockClear();
    await getCommentsPayload({ targetId: 1, type: "course" }, viewer);

    expect(getViewerContextMock).not.toHaveBeenCalled();
    expect(writeCommentsStageAnalyticsMock).toHaveBeenCalledOnce();
    expect(writeCommentsStageAnalyticsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dbQueryCount: 0,
        dbTransactionCount: 0,
        stage: "viewer.context",
      }),
    );
  });
});
