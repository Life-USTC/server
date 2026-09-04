import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireAuthMock = vi.fn();
const withUserDbContextMock = vi.fn();

vi.mock("@/lib/auth/api-auth", () => ({
  requireAuth: requireAuthMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    dashboardLinkPin: {
      deleteMany: vi.fn(),
      findMany: vi.fn(),
    },
  },
  withUserDbContext: withUserDbContextMock,
}));

describe("POST /api/workspace/link-pins", () => {
  beforeEach(() => {
    vi.resetModules();
    requireAuthMock.mockResolvedValue({ userId: "user-1" });
    withUserDbContextMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("当固定链接持久化失败时返回 500 JSON 错误", async () => {
    withUserDbContextMock.mockRejectedValue(new Error("db write failed"));
    const { postDashboardLinkPinRoute } = await import(
      "@/lib/api/routes/dashboard-link-pin-route"
    );

    const form = new FormData();
    form.set("slug", "jw");
    form.set("action", "pin");
    form.set("returnTo", "/");

    const response = await postDashboardLinkPinRoute(
      new Request("http://localhost/api/workspace/link-pins", {
        method: "POST",
        body: form,
        headers: {
          accept: "application/json",
        },
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      pinnedSlugs: [],
      maxPinnedLinks: 4,
      error: "Failed to update dashboard link pin state",
    });
  });

  it("JSON 客户端收到保留 Retry-After 的原始限流响应", async () => {
    requireAuthMock.mockResolvedValue(
      Response.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": "60" } },
      ),
    );
    const { postDashboardLinkPinRoute } = await import(
      "@/lib/api/routes/dashboard-link-pin-route"
    );

    const response = await postDashboardLinkPinRoute(
      new Request("http://localhost/api/workspace/link-pins", {
        method: "POST",
        body: new FormData(),
        headers: { accept: "application/json" },
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(withUserDbContextMock).not.toHaveBeenCalled();
  });

  it("HTML 表单被限流时重定向并标记错误", async () => {
    requireAuthMock.mockResolvedValue(
      Response.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": "60" } },
      ),
    );
    const { postDashboardLinkPinRoute } = await import(
      "@/lib/api/routes/dashboard-link-pin-route"
    );

    const response = await postDashboardLinkPinRoute(
      new Request("http://localhost/api/workspace/link-pins", {
        method: "POST",
        body: new FormData(),
      }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe(
      "http://localhost/?dashboardLinkPinError=1",
    );
    expect(withUserDbContextMock).not.toHaveBeenCalled();
  });
});
