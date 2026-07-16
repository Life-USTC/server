import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const requireAuthMock = vi.fn();
const deleteOwnCommentMock = vi.fn();

vi.mock("@/lib/auth/api-auth", () => ({
  requireAuth: requireAuthMock,
}));

vi.mock("@/features/comments/server/comment-mutations", () => ({
  deleteOwnComment: deleteOwnCommentMock,
}));

function deleteRequest(body: unknown) {
  return new Request("https://example.test/api/comments/batch", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "DELETE",
  });
}

function unauthorizedResponse() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

describe("deleteCommentBatchRoute", () => {
  let deleteCommentBatchRoute: typeof import("@/lib/api/routes/comment-batch-route").deleteCommentBatchRoute;

  beforeAll(async () => {
    ({ deleteCommentBatchRoute } = await import(
      "@/lib/api/routes/comment-batch-route"
    ));
  });

  afterEach(() => {
    requireAuthMock.mockReset();
    deleteOwnCommentMock.mockReset();
  });

  it("在解析 JSON 请求体之前先认证", async () => {
    requireAuthMock.mockResolvedValue(unauthorizedResponse());

    const response = await deleteCommentBatchRoute(
      deleteRequest({ ids: ["comment-1"] }),
    );

    expect(response.status).toBe(401);
    expect(requireAuthMock).toHaveBeenCalledOnce();
    expect(deleteOwnCommentMock).not.toHaveBeenCalled();
  });

  it("成功批量删除评论并返回成功项", async () => {
    requireAuthMock.mockResolvedValue({ userId: "user-1" });
    deleteOwnCommentMock
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true });

    const response = await deleteCommentBatchRoute(
      deleteRequest({ ids: ["comment-1", "comment-2"] }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.results).toEqual([
      { success: true, id: "comment-1" },
      { success: true, id: "comment-2" },
    ]);
    expect(deleteOwnCommentMock).toHaveBeenCalledWith({
      auditMetadata: { ipAddress: undefined, userAgent: undefined },
      commentId: "comment-1",
      userId: "user-1",
    });
    expect(deleteOwnCommentMock).toHaveBeenCalledWith({
      auditMetadata: { ipAddress: undefined, userAgent: undefined },
      commentId: "comment-2",
      userId: "user-1",
    });
  });

  it("对找不到、非所有者或锁定的评论返回失败项而不中断批量处理", async () => {
    requireAuthMock.mockResolvedValue({ userId: "user-1" });
    deleteOwnCommentMock
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, error: "not_found" })
      .mockResolvedValueOnce({ ok: false, error: "forbidden" })
      .mockResolvedValueOnce({ ok: false, error: "locked" });

    const response = await deleteCommentBatchRoute(
      deleteRequest({
        ids: [
          "comment-1",
          "comment-missing",
          "comment-owned-by-other",
          "comment-locked",
        ],
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.results).toEqual([
      { success: true, id: "comment-1" },
      {
        success: false,
        id: "comment-missing",
        error: { code: "not_found", message: "Comment not found" },
      },
      {
        success: false,
        id: "comment-owned-by-other",
        error: { code: "forbidden", message: "Forbidden" },
      },
      {
        success: false,
        id: "comment-locked",
        error: { code: "locked", message: "Comment locked" },
      },
    ]);
  });

  it("将 suspended 错误映射为 forbidden", async () => {
    requireAuthMock.mockResolvedValue({ userId: "user-1" });
    deleteOwnCommentMock.mockResolvedValueOnce({
      ok: false,
      error: "suspended",
      reason: "spam",
    });

    const response = await deleteCommentBatchRoute(
      deleteRequest({ ids: ["comment-1"] }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.results).toEqual([
      {
        success: false,
        id: "comment-1",
        error: { code: "forbidden", message: "Forbidden" },
      },
    ]);
  });

  it("拒绝空 ids 数组", async () => {
    requireAuthMock.mockResolvedValue({ userId: "user-1" });

    const response = await deleteCommentBatchRoute(deleteRequest({ ids: [] }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid batch payload");
    expect(deleteOwnCommentMock).not.toHaveBeenCalled();
  });

  it("拒绝包含空字符串 id 的 payload", async () => {
    requireAuthMock.mockResolvedValue({ userId: "user-1" });

    const response = await deleteCommentBatchRoute(
      deleteRequest({ ids: ["comment-1", ""] }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid batch payload");
    expect(deleteOwnCommentMock).not.toHaveBeenCalled();
  });
});
