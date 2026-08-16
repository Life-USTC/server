import { afterEach, describe, expect, it, vi } from "vitest";

const {
  findActiveSuspensionMock,
  getSessionFromHeadersMock,
  resolveAuthoritativeRecentSessionMock,
  userFindUniqueMock,
} = vi.hoisted(() => ({
  findActiveSuspensionMock: vi.fn(),
  getSessionFromHeadersMock: vi.fn(),
  resolveAuthoritativeRecentSessionMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
}));

vi.mock("@/lib/auth/core", () => ({
  getSessionFromHeaders: getSessionFromHeadersMock,
}));

vi.mock("@/lib/auth/viewer-context", () => ({
  findActiveSuspension: findActiveSuspensionMock,
}));

vi.mock("@/lib/auth/recent-session", () => ({
  resolveAuthoritativeRecentSession: resolveAuthoritativeRecentSessionMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      findUnique: userFindUniqueMock,
    },
  },
}));

describe("admin 页面认证", () => {
  afterEach(() => {
    findActiveSuspensionMock.mockReset();
    getSessionFromHeadersMock.mockReset();
    resolveAuthoritativeRecentSessionMock.mockReset();
    userFindUniqueMock.mockReset();
    vi.resetModules();
  });

  it("敏感管理页面操作拒绝过期的 recent-auth", async () => {
    getSessionFromHeadersMock.mockResolvedValue({
      user: { id: "admin-1" },
    });
    userFindUniqueMock.mockResolvedValue({
      id: "admin-1",
      isAdmin: true,
      name: "Admin",
      username: "admin",
    });
    findActiveSuspensionMock.mockResolvedValue(null);
    resolveAuthoritativeRecentSessionMock.mockResolvedValue({
      ok: false,
      reason: "session_not_fresh",
      sessionId: "session-1",
      userId: "admin-1",
    });
    const { requireAdminPage } = await import(
      "@/features/admin/server/admin-page-auth"
    );
    const request = new Request("https://example.test/admin/oauth", {
      headers: { cookie: "better-auth.session_token=session-token" },
    });

    await expect(
      requireAdminPage(request, { requireActive: true, requireRecent: true }),
    ).rejects.toMatchObject({
      location: "/account/sign-in?reauth=1&callbackUrl=%2Fadmin%2Foauth",
      status: 303,
    });
    expect(resolveAuthoritativeRecentSessionMock).toHaveBeenCalledWith(
      request.headers,
      { expectedUserId: "admin-1" },
    );
  });

  it("允许被暂停的管理员加载只读管理页面", async () => {
    getSessionFromHeadersMock.mockResolvedValue({
      user: { id: "admin-1" },
    });
    userFindUniqueMock.mockResolvedValue({
      id: "admin-1",
      isAdmin: true,
      name: "Admin",
      username: "admin",
    });
    const { requireAdminPage } = await import(
      "@/features/admin/server/admin-page-auth"
    );

    const admin = await requireAdminPage(
      new Request("https://example.test/admin/moderation", {
        headers: {
          cookie: "better-auth.session_token=session-token",
        },
      }),
    );

    expect(admin.id).toBe("admin-1");
    expect(findActiveSuspensionMock).not.toHaveBeenCalled();
  });

  it("阻止被暂停的管理员执行管理页面操作", async () => {
    getSessionFromHeadersMock.mockResolvedValue({
      user: { id: "admin-1" },
    });
    userFindUniqueMock.mockResolvedValue({
      id: "admin-1",
      isAdmin: true,
      name: "Admin",
      username: "admin",
    });
    findActiveSuspensionMock.mockResolvedValue({
      reason: "policy hold",
    });
    const { requireAdminPage } = await import(
      "@/features/admin/server/admin-page-auth"
    );

    await expect(
      requireAdminPage(
        new Request("https://example.test/admin/moderation", {
          headers: {
            cookie: "better-auth.session_token=session-token",
          },
        }),
        { requireActive: true },
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
});
