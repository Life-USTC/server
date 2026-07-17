import { afterEach, describe, expect, it, vi } from "vitest";

const requireAuthMock = vi.fn();
const updateDashboardLinkPinStateMock = vi.fn();
const resolveDashboardLinkBySlugMock = vi.fn();

vi.mock("@/lib/auth/api-auth", () => ({
  requireAuth: requireAuthMock,
}));

const logDashboardLinkPinFailureMock = vi.fn();

vi.mock("@/features/dashboard-links/server/dashboard-link-service", () => ({
  MAX_PINNED_LINKS: 4,
  logDashboardLinkPinFailure: logDashboardLinkPinFailureMock,
  resolveDashboardLinkBySlug: resolveDashboardLinkBySlugMock,
  updateDashboardLinkPinState: updateDashboardLinkPinStateMock,
}));

function postRequest(body: unknown) {
  return new Request("https://example.test/api/dashboard-links/pin/batch", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

function unauthorizedResponse() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

describe("postDashboardLinkPinBatchRoute", () => {
  afterEach(() => {
    requireAuthMock.mockReset();
    updateDashboardLinkPinStateMock.mockReset();
    resolveDashboardLinkBySlugMock.mockReset();
    logDashboardLinkPinFailureMock.mockReset();
    vi.resetModules();
  });

  it("在解析 JSON 请求体之前先认证", async () => {
    requireAuthMock.mockResolvedValue(unauthorizedResponse());
    const { postDashboardLinkPinBatchRoute } = await import(
      "@/lib/api/routes/dashboard-link-pin-route"
    );

    const response = await postDashboardLinkPinBatchRoute(
      postRequest({
        items: [{ slug: "mail", action: "pin" }],
      }),
    );

    expect(response.status).toBe(401);
    expect(requireAuthMock).toHaveBeenCalledOnce();
    expect(updateDashboardLinkPinStateMock).not.toHaveBeenCalled();
  });

  it("成功批量置顶与取消置顶并返回最终置顶列表", async () => {
    requireAuthMock.mockResolvedValue({ userId: "user-1" });
    resolveDashboardLinkBySlugMock.mockReturnValue({ slug: "mail" });
    updateDashboardLinkPinStateMock
      .mockResolvedValueOnce(["mail"])
      .mockResolvedValueOnce([]);

    const { postDashboardLinkPinBatchRoute } = await import(
      "@/lib/api/routes/dashboard-link-pin-route"
    );

    const response = await postDashboardLinkPinBatchRoute(
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
    expect(updateDashboardLinkPinStateMock).toHaveBeenCalledWith({
      action: "pin",
      slug: "mail",
      userId: "user-1",
    });
    expect(updateDashboardLinkPinStateMock).toHaveBeenCalledWith({
      action: "unpin",
      slug: "mail",
      userId: "user-1",
    });
  });

  it("拒绝无效批量 payload", async () => {
    requireAuthMock.mockResolvedValue({ userId: "user-1" });

    const { postDashboardLinkPinBatchRoute } = await import(
      "@/lib/api/routes/dashboard-link-pin-route"
    );

    const response = await postDashboardLinkPinBatchRoute(
      postRequest({
        items: [{ slug: "", action: "pin" }],
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid batch payload");
    expect(updateDashboardLinkPinStateMock).not.toHaveBeenCalled();
  });

  it("要求至少一个 item", async () => {
    requireAuthMock.mockResolvedValue({ userId: "user-1" });

    const { postDashboardLinkPinBatchRoute } = await import(
      "@/lib/api/routes/dashboard-link-pin-route"
    );

    const response = await postDashboardLinkPinBatchRoute(
      postRequest({ items: [] }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid batch payload");
  });

  it("对不存在的 slug 返回 400", async () => {
    requireAuthMock.mockResolvedValue({ userId: "user-1" });
    resolveDashboardLinkBySlugMock.mockReturnValue(null);

    const { postDashboardLinkPinBatchRoute } = await import(
      "@/lib/api/routes/dashboard-link-pin-route"
    );

    const response = await postDashboardLinkPinBatchRoute(
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
    expect(updateDashboardLinkPinStateMock).not.toHaveBeenCalled();
  });

  it("当持久化失败时返回 500", async () => {
    requireAuthMock.mockResolvedValue({ userId: "user-1" });
    resolveDashboardLinkBySlugMock.mockReturnValue({ slug: "mail" });
    updateDashboardLinkPinStateMock.mockRejectedValue(
      new Error("db write failed"),
    );

    const { postDashboardLinkPinBatchRoute } = await import(
      "@/lib/api/routes/dashboard-link-pin-route"
    );

    const response = await postDashboardLinkPinBatchRoute(
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
