import { afterEach, describe, expect, it, vi } from "vitest";

const deleteOwnCommentMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/comments/server/comment-mutations", () => ({
  deleteOwnComment: deleteOwnCommentMock,
}));

import { deleteOwnCommentsBatch } from "@/features/comments/server/comment-batch-delete";

describe("deleteOwnCommentsBatch", () => {
  afterEach(() => {
    deleteOwnCommentMock.mockReset();
  });

  it("returns stable per-item results while reusing the audited single delete", async () => {
    deleteOwnCommentMock
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, error: "not_found" })
      .mockResolvedValueOnce({
        ok: false,
        error: "suspended",
        reason: "spam",
      });

    await expect(
      deleteOwnCommentsBatch({
        auditMetadata: { source: "graphql" },
        ids: ["comment-1", "comment-missing", "comment-suspended"],
        userId: "user-1",
      }),
    ).resolves.toEqual({
      results: [
        { success: true, id: "comment-1" },
        {
          success: false,
          id: "comment-missing",
          error: { code: "not_found", message: "Comment not found" },
        },
        {
          success: false,
          id: "comment-suspended",
          error: { code: "forbidden", message: "Forbidden" },
        },
      ],
    });
    expect(deleteOwnCommentMock).toHaveBeenNthCalledWith(1, {
      auditMetadata: { source: "graphql" },
      commentId: "comment-1",
      userId: "user-1",
    });
    expect(deleteOwnCommentMock).toHaveBeenCalledTimes(3);
  });
});
