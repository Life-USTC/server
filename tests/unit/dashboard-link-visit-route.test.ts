import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";

const { recordDashboardLinkClickMock, resolveApiUserIdMock } = vi.hoisted(
  () => ({
    recordDashboardLinkClickMock: vi.fn(),
    resolveApiUserIdMock: vi.fn(),
  }),
);

vi.mock("@/features/dashboard-links/server/dashboard-link-service", () => ({
  recordDashboardLinkClick: recordDashboardLinkClickMock,
  resolveDashboardLinkBySlug: (slug: string) =>
    slug === "jw" ? { slug: "jw", url: "https://jw.ustc.edu.cn/" } : null,
}));

vi.mock("@/lib/auth/api-auth", () => ({
  resolveApiUserId: resolveApiUserIdMock,
}));

describe("POST /api/dashboard-links/visit", () => {
  beforeEach(() => {
    setCloudflareRuntimeEnv(undefined);
    resolveApiUserIdMock.mockResolvedValue("user-1");
    recordDashboardLinkClickMock.mockReset();
  });

  afterEach(() => {
    setCloudflareRuntimeEnv(undefined);
  });

  it("超过点击写入预算时跳过计数但仍重定向", async () => {
    const limit = vi.fn().mockResolvedValue({ success: false });
    setCloudflareRuntimeEnv({ USER_WRITE_RATE_LIMITER: { limit } });
    const { postDashboardLinkVisitRoute } = await import(
      "@/lib/api/routes/dashboard-link-visit-routes"
    );
    const form = new FormData();
    form.set("slug", "jw");

    const response = await postDashboardLinkVisitRoute(
      new Request("https://life.example/api/dashboard-links/visit", {
        method: "POST",
        body: form,
      }),
    );

    expect(response.status).toBe(303);
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
    const { postDashboardLinkVisitRoute } = await import(
      "@/lib/api/routes/dashboard-link-visit-routes"
    );
    const form = new FormData();
    form.set("slug", "jw");

    const response = await postDashboardLinkVisitRoute(
      new Request("https://life.example/api/dashboard-links/visit", {
        method: "POST",
        body: form,
      }),
    );

    expect(response.status).toBe(303);
    expect(recordDashboardLinkClickMock).toHaveBeenCalledWith("user-1", "jw");
  });
});
