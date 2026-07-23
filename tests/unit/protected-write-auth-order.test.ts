import { afterEach, describe, expect, it, vi } from "vitest";

const {
  requireAuthMock,
  requireWriteAuthMock,
  updateDashboardLinkPinStateMock,
  renameOwnedUploadMock,
} = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  requireWriteAuthMock: vi.fn(),
  updateDashboardLinkPinStateMock: vi.fn(),
  renameOwnedUploadMock: vi.fn(),
}));

vi.mock("@/lib/auth/api-auth", () => ({
  requireAuth: requireAuthMock,
  requireWriteAuth: requireWriteAuthMock,
}));

vi.mock("@/features/comments/server/comment-mutations", () => ({
  createComment: vi.fn(),
  updateOwnComment: vi.fn(),
}));

vi.mock("@/features/descriptions/server/description-upsert", () => ({
  upsertDescriptionContent: vi.fn(),
}));

vi.mock("@/features/uploads/server/upload-service", () => ({
  deleteOwnedUpload: vi.fn(),
  listUploads: vi.fn(),
  renameOwnedUpload: renameOwnedUploadMock,
}));

vi.mock("@/features/dashboard-links/server/dashboard-link-service", () => ({
  MAX_PINNED_LINKS: 6,
  logDashboardLinkPinFailure: vi.fn(),
  resolveDashboardLinkBySlug: vi.fn(),
  sanitizeDashboardReturnTo: (value: string | null | undefined) => value || "/",
  updateDashboardLinkPinState: updateDashboardLinkPinStateMock,
}));

function unauthorizedResponse() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

function jsonRequest(url: string, method: string) {
  return new Request(url, {
    body: "{",
    headers: { "Content-Type": "application/json" },
    method,
  });
}

describe("受保护写入路由认证顺序", () => {
  afterEach(() => {
    requireAuthMock.mockReset();
    requireWriteAuthMock.mockReset();
    updateDashboardLinkPinStateMock.mockReset();
    renameOwnedUploadMock.mockReset();
    vi.resetModules();
  });

  it("在解析 JSON 请求体之前认证评论创建", async () => {
    requireAuthMock.mockResolvedValue(unauthorizedResponse());
    const { postCommentRoute } = await import(
      "@/lib/api/routes/comments-create-route"
    );

    const response = await postCommentRoute(
      jsonRequest("https://example.test/api/community/comments", "POST"),
    );

    expect(response.status).toBe(401);
    expect(requireAuthMock).toHaveBeenCalledOnce();
  });

  it("在解析 JSON 请求体之前认证评论更新", async () => {
    requireAuthMock.mockResolvedValue(unauthorizedResponse());
    const { patchCommentRoute } = await import(
      "@/lib/api/routes/comments-update-route"
    );

    const response = await patchCommentRoute(
      jsonRequest(
        "https://example.test/api/community/comments/comment-1",
        "PATCH",
      ),
      { id: "comment-1" },
    );

    expect(response.status).toBe(401);
    expect(requireAuthMock).toHaveBeenCalledOnce();
  });

  it("在解析 JSON 请求体之前认证描述写入", async () => {
    requireAuthMock.mockResolvedValue(unauthorizedResponse());
    const { postDescriptionRoute } = await import(
      "@/lib/api/routes/description-upsert-route"
    );

    const response = await postDescriptionRoute(
      jsonRequest("https://example.test/api/community/descriptions", "POST"),
    );

    expect(response.status).toBe(401);
    expect(requireAuthMock).toHaveBeenCalledOnce();
  });

  it("在解析 JSON 请求体之前认证上传重命名", async () => {
    requireWriteAuthMock.mockResolvedValue(unauthorizedResponse());
    const { patchUploadRoute } = await import(
      "@/lib/api/routes/upload-management-routes"
    );

    const response = await patchUploadRoute(
      jsonRequest(
        "https://example.test/api/workspace/uploads/upload-1",
        "PATCH",
      ),
      { id: "upload-1" },
    );

    expect(response.status).toBe(401);
    expect(requireWriteAuthMock).toHaveBeenCalledOnce();
    expect(renameOwnedUploadMock).not.toHaveBeenCalled();
  });

  it("在解析表单数据之前认证仪表盘链接置顶", async () => {
    requireAuthMock.mockResolvedValue(unauthorizedResponse());
    const { postDashboardLinkPinRoute } = await import(
      "@/lib/api/routes/dashboard-link-pin-route"
    );

    const response = await postDashboardLinkPinRoute(
      new Request("https://example.test/api/workspace/link-pins", {
        body: "not-form-data",
        headers: {
          accept: "application/json",
          "Content-Type": "text/plain",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(401);
    expect(requireAuthMock).toHaveBeenCalledWith(expect.any(Request), {
      bearerScope: { feature: "workspace.link-pin", action: "write" },
      rateLimit: { action: "workspace.link-pin:write" },
    });
    expect(updateDashboardLinkPinStateMock).not.toHaveBeenCalled();
  });
});
