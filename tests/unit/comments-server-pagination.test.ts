import { beforeEach, describe, expect, it, vi } from "vitest";

const { loadCommentThread, resolveCommentTarget } = vi.hoisted(() => ({
  loadCommentThread: vi.fn(),
  resolveCommentTarget: vi.fn(),
}));

vi.mock("@/features/comments/server/comment-read-model", () => ({
  loadCommentThread,
}));
vi.mock("@/features/comments/server/comment-utils", () => ({
  resolveCommentTarget,
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
      expect.objectContaining({ pagination: { pageSize: 20, skip: 0 } }),
    );
    expect(result.complete).toBe(false);
  });
});
