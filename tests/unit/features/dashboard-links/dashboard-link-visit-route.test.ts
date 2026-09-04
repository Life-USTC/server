import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";

const { recordDashboardLinkClickMock, resolveSessionUserIdMock } = vi.hoisted(
  () => ({
    recordDashboardLinkClickMock: vi.fn(),
    resolveSessionUserIdMock: vi.fn(),
  }),
);

vi.mock("@/features/dashboard-links/server/dashboard-link-service", () => ({
  recordDashboardLinkClick: recordDashboardLinkClickMock,
  resolveDashboardLinkBySlug: (slug: string) =>
    slug === "jw" ? { slug: "jw", url: "https://jw.ustc.edu.cn/" } : null,
}));

vi.mock("@/lib/auth/api-auth", () => ({
  resolveSessionUserId: resolveSessionUserIdMock,
}));

describe("GET /api/catalog/links/resolve", () => {
  beforeEach(() => {
    setCloudflareRuntimeEnv(undefined);
    resolveSessionUserIdMock.mockResolvedValue("user-1");
    recordDashboardLinkClickMock.mockReset();
  });

  afterEach(() => {
    setCloudflareRuntimeEnv(undefined);
  });

  it("超过点击写入预算时跳过计数但仍重定向", async () => {
    const limit = vi.fn().mockResolvedValue({ success: false });
    setCloudflareRuntimeEnv({ USER_WRITE_RATE_LIMITER: { limit } });
    const { getDashboardLinkVisitRoute } = await import(
      "@/lib/api/routes/dashboard-link-visit-routes"
    );

    const response = await getDashboardLinkVisitRoute(
      new Request("https://life.example/api/catalog/links/resolve?slug=jw"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("Location")).toBe("https://jw.ustc.edu.cn/");
    expect(recordDashboardLinkClickMock).not.toHaveBeenCalled();
    expect(limit).toHaveBeenCalledOnce();
  });

  it("预算允许时记录点击并重定向", async () => {
    setCloudflareRuntimeEnv({
      USER_WRITE_RATE_LIMITER: {
        limit: vi.fn().mockResolvedValue({ success: true }),
      },
    });
    const { getDashboardLinkVisitRoute } = await import(
      "@/lib/api/routes/dashboard-link-visit-routes"
    );

    const response = await getDashboardLinkVisitRoute(
      new Request("https://life.example/api/catalog/links/resolve?slug=jw"),
    );

    expect(response.status).toBe(307);
    expect(recordDashboardLinkClickMock).toHaveBeenCalledWith("user-1", "jw");
  });

  it("未登录时不记录点击但仍重定向", async () => {
    resolveSessionUserIdMock.mockResolvedValue(null);
    const { getDashboardLinkVisitRoute } = await import(
      "@/lib/api/routes/dashboard-link-visit-routes"
    );

    const response = await getDashboardLinkVisitRoute(
      new Request("https://life.example/api/catalog/links/resolve?slug=jw"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("Location")).toBe("https://jw.ustc.edu.cn/");
    expect(recordDashboardLinkClickMock).not.toHaveBeenCalled();
  });
});
