import { afterEach, describe, expect, it, vi } from "vitest";

const requireAuthMock = vi.fn();
const updateWorkspaceLinkPinStateMock = vi.fn();
const resolveCatalogLinkBySlugMock = vi.fn();

vi.mock("@/lib/auth/api-auth", () => ({
  requireAuth: requireAuthMock,
}));

const logWorkspaceLinkPinFailureMock = vi.fn();

vi.mock("@/features/catalog-links/server/catalog-link-service", () => ({
  MAX_PINNED_LINKS: 4,
  logWorkspaceLinkPinFailure: logWorkspaceLinkPinFailureMock,
  resolveCatalogLinkBySlug: resolveCatalogLinkBySlugMock,
  updateWorkspaceLinkPinState: updateWorkspaceLinkPinStateMock,
}));

function postRequest(body: unknown) {
  return new Request("https://example.test/api/workspace/link-pins/batch", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

function unauthorizedResponse() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

describe("postWorkspaceLinkPinBatchRoute", () => {
  afterEach(() => {
    requireAuthMock.mockReset();
    updateWorkspaceLinkPinStateMock.mockReset();
    resolveCatalogLinkBySlugMock.mockReset();
    logWorkspaceLinkPinFailureMock.mockReset();
    vi.resetModules();
  });

  it("在解析 JSON 请求体之前先认证", async () => {
    requireAuthMock.mockResolvedValue(unauthorizedResponse());
    const { postWorkspaceLinkPinBatchRoute } = await import(
      "@/lib/api/routes/workspace-link-pin-route"
    );

    const response = await postWorkspaceLinkPinBatchRoute(
      postRequest({
        items: [{ slug: "mail", action: "pin" }],
      }),
    );

    expect(response.status).toBe(401);
    expect(requireAuthMock).toHaveBeenCalledOnce();
    expect(updateWorkspaceLinkPinStateMock).not.toHaveBeenCalled();
  });

  it("成功批量置顶与取消置顶并返回最终置顶列表", async () => {
    requireAuthMock.mockResolvedValue({ userId: "user-1" });
    resolveCatalogLinkBySlugMock.mockReturnValue({ slug: "mail" });
    updateWorkspaceLinkPinStateMock
      .mockResolvedValueOnce(["mail"])
      .mockResolvedValueOnce([]);

    const { postWorkspaceLinkPinBatchRoute } = await import(
      "@/lib/api/routes/workspace-link-pin-route"
    );

    const response = await postWorkspaceLinkPinBatchRoute(
      postRequest({
        items: [
          { slug: "mail", action: "pin" },
          { slug: "mail", action: "unpin" },
        ],
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      pinnedSlugs: [],
      maxPinnedLinks: 4,
      error: null,
    });
    expect(updateWorkspaceLinkPinStateMock).toHaveBeenCalledWith({
      action: "pin",
      slug: "mail",
      userId: "user-1",
    });
    expect(updateWorkspaceLinkPinStateMock).toHaveBeenCalledWith({
      action: "unpin",
      slug: "mail",
      userId: "user-1",
    });
  });

  it("拒绝无效批量 payload", async () => {
    requireAuthMock.mockResolvedValue({ userId: "user-1" });

    const { postWorkspaceLinkPinBatchRoute } = await import(
      "@/lib/api/routes/workspace-link-pin-route"
    );

    const response = await postWorkspaceLinkPinBatchRoute(
      postRequest({
        items: [{ slug: "", action: "pin" }],
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid batch payload");
    expect(updateWorkspaceLinkPinStateMock).not.toHaveBeenCalled();
  });

  it("要求至少一个 item", async () => {
    requireAuthMock.mockResolvedValue({ userId: "user-1" });

    const { postWorkspaceLinkPinBatchRoute } = await import(
      "@/lib/api/routes/workspace-link-pin-route"
    );

    const response = await postWorkspaceLinkPinBatchRoute(
      postRequest({ items: [] }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid batch payload");
  });

  it("对不存在的 slug 返回 400", async () => {
    requireAuthMock.mockResolvedValue({ userId: "user-1" });
    resolveCatalogLinkBySlugMock.mockReturnValue(null);

    const { postWorkspaceLinkPinBatchRoute } = await import(
      "@/lib/api/routes/workspace-link-pin-route"
    );

    const response = await postWorkspaceLinkPinBatchRoute(
      postRequest({
        items: [{ slug: "missing-dashboard-link", action: "pin" }],
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({
      pinnedSlugs: [],
      maxPinnedLinks: 4,
      error: "Invalid dashboard link slug: missing-dashboard-link",
    });
    expect(updateWorkspaceLinkPinStateMock).not.toHaveBeenCalled();
  });

  it("当持久化失败时返回 500", async () => {
    requireAuthMock.mockResolvedValue({ userId: "user-1" });
    resolveCatalogLinkBySlugMock.mockReturnValue({ slug: "mail" });
    updateWorkspaceLinkPinStateMock.mockRejectedValue(
      new Error("db write failed"),
    );

    const { postWorkspaceLinkPinBatchRoute } = await import(
      "@/lib/api/routes/workspace-link-pin-route"
    );

    const response = await postWorkspaceLinkPinBatchRoute(
      postRequest({
        items: [{ slug: "mail", action: "pin" }],
      }),
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toMatchObject({
      pinnedSlugs: [],
      maxPinnedLinks: 4,
      error: "Failed to update dashboard link pin state",
    });
  });
});
