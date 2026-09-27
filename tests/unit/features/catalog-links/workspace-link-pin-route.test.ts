import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireAuthMock = vi.fn();
const withUserDbContextMock = vi.fn();

vi.mock("@/lib/auth/api-auth", () => ({
  requireAuth: requireAuthMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    workspaceLinkPin: {
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
    const { postWorkspaceLinkPinRoute } = await import(
      "@/lib/api/routes/workspace-link-pin-route"
    );

    const form = new FormData();
    form.set("slug", "jw");
    form.set("action", "pin");
    form.set("returnTo", "/");

    const response = await postWorkspaceLinkPinRoute(
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
      error: "Failed to update workspace link pin state",
    });
  });

  it("openapi.pin-json-rate-limit-response", async () => {
    const { postWorkspaceLinkPinRoute } = await import(
      "@/lib/api/routes/workspace-link-pin-route"
    );
    for (const status of [429, 503]) {
      const rejected = Response.json(
        { error: "Rate limit rejection" },
        { status, headers: { "Retry-After": "60" } },
      );
      requireAuthMock.mockResolvedValue(rejected);
      const response = await postWorkspaceLinkPinRoute(
        new Request("http://localhost/api/workspace/link-pins", {
          method: "POST",
          body: new FormData(),
          headers: { accept: "application/json" },
        }),
      );
      expect(response).toBe(rejected);
      expect(response.status).toBe(status);
      expect(response.headers.get("Retry-After")).toBe("60");
      expect(withUserDbContextMock).not.toHaveBeenCalled();
    }
  });

  it("openapi.pin-form-rate-limit-fallback", async () => {
    const { postWorkspaceLinkPinRoute } = await import(
      "@/lib/api/routes/workspace-link-pin-route"
    );
    for (const status of [429, 503]) {
      requireAuthMock.mockResolvedValue(
        Response.json(
          { error: "Rate limit rejection" },
          { status, headers: { "Retry-After": "60" } },
        ),
      );
      const response = await postWorkspaceLinkPinRoute(
        new Request("http://localhost/api/workspace/link-pins", {
          method: "POST",
          body: new FormData(),
        }),
      );
      expect(response.status).toBe(303);
      expect(response.headers.get("Location")).toBe(
        "http://localhost/?workspaceLinkPinError=1",
      );
      expect(withUserDbContextMock).not.toHaveBeenCalled();
    }
  });
});
