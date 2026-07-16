import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireAuthMock = vi.fn();
const transactionMock = vi.fn();

vi.mock("@/lib/auth/api-auth", () => ({
  requireAuth: requireAuthMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: transactionMock,
    dashboardLinkPin: {
      deleteMany: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

describe("POST /api/dashboard-links/pin", () => {
  beforeEach(() => {
    vi.resetModules();
    requireAuthMock.mockResolvedValue({ userId: "user-1" });
    transactionMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("当固定链接持久化失败时返回 500 JSON 错误", async () => {
    transactionMock.mockRejectedValue(new Error("db write failed"));
    const { postDashboardLinkPinRoute } = await import(
      "@/lib/api/routes/dashboard-links"
    );

    const form = new FormData();
    form.set("slug", "jw");
    form.set("action", "pin");
    form.set("returnTo", "/");

    const response = await postDashboardLinkPinRoute(
      new Request("http://localhost/api/dashboard-links/pin", {
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
      "@/lib/api/routes/dashboard-links"
    );

    const response = await postDashboardLinkPinRoute(
      new Request("http://localhost/api/dashboard-links/pin", {
        method: "POST",
        body: new FormData(),
        headers: { accept: "application/json" },
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("HTML 表单被限流时重定向并标记错误", async () => {
    requireAuthMock.mockResolvedValue(
      Response.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": "60" } },
      ),
    );
    const { postDashboardLinkPinRoute } = await import(
      "@/lib/api/routes/dashboard-links"
    );

    const response = await postDashboardLinkPinRoute(
      new Request("http://localhost/api/dashboard-links/pin", {
        method: "POST",
        body: new FormData(),
      }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe(
      "http://localhost/?dashboardLinkPinError=1",
    );
    expect(transactionMock).not.toHaveBeenCalled();
  });
});
