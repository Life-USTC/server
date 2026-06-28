import { afterEach, describe, expect, it, vi } from "vitest";

const {
  createAdminSuspensionMock,
  listAdminSuspensionsMock,
  updateAdminUserMock,
  withAdminApiRouteMock,
} = vi.hoisted(() => ({
  createAdminSuspensionMock: vi.fn(),
  listAdminSuspensionsMock: vi.fn(),
  updateAdminUserMock: vi.fn(),
  withAdminApiRouteMock: vi.fn(
    async (
      _request: Request,
      _message: string,
      handler: (admin: { userId: string }) => Promise<Response>,
    ) => handler({ userId: "admin-1" }),
  ),
}));

vi.mock("@/features/admin/server/admin-api-service", () => ({
  createAdminSuspension: createAdminSuspensionMock,
  liftAdminSuspension: vi.fn(),
  listAdminSuspensions: listAdminSuspensionsMock,
  updateAdminUser: updateAdminUserMock,
}));

vi.mock("@/features/admin/server/admin-user-read-model", () => ({
  listAdminUsers: vi.fn(),
}));

vi.mock("@/lib/api/routes/admin-route-auth", () => ({
  withAdminApiRoute: withAdminApiRouteMock,
}));

function jsonRequest(path: string, body: unknown) {
  return new Request(`https://example.test${path}`, {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "PATCH",
  });
}

describe("admin 用户路由", () => {
  afterEach(() => {
    createAdminSuspensionMock.mockReset();
    listAdminSuspensionsMock.mockReset();
    updateAdminUserMock.mockReset();
    withAdminApiRouteMock.mockClear();
    vi.resetModules();
  });

  it("将当前管理员 id 传入用户更新", async () => {
    updateAdminUserMock.mockResolvedValue({
      ok: true,
      user: { id: "user-1" },
    });
    const { patchAdminUserRoute } = await import(
      "@/lib/api/routes/admin-users"
    );

    const response = await patchAdminUserRoute(
      jsonRequest("/api/admin/users/user-1", { name: "User" }),
      { id: "user-1" },
    );

    expect(response.status).toBe(200);
    expect(updateAdminUserMock).toHaveBeenCalledWith("admin-1", "user-1", {
      name: "User",
    });
  });

  it("将自我降权映射为公开 400 响应", async () => {
    updateAdminUserMock.mockResolvedValue({
      ok: false,
      reason: "cannot_demote_self",
    });
    const { patchAdminUserRoute } = await import(
      "@/lib/api/routes/admin-users"
    );

    const response = await patchAdminUserRoute(
      jsonRequest("/api/admin/users/admin-1", { isAdmin: false }),
      { id: "admin-1" },
    );

    await expect(response.json()).resolves.toEqual({
      error: "Admins cannot remove their own admin role",
    });
    expect(response.status).toBe(400);
  });

  it("将移除最后管理员映射为公开 400 响应", async () => {
    updateAdminUserMock.mockResolvedValue({
      ok: false,
      reason: "cannot_remove_last_admin",
    });
    const { patchAdminUserRoute } = await import(
      "@/lib/api/routes/admin-users"
    );

    const response = await patchAdminUserRoute(
      jsonRequest("/api/admin/users/admin-2", { isAdmin: false }),
      { id: "admin-2" },
    );

    await expect(response.json()).resolves.toEqual({
      error: "At least one admin must remain",
    });
    expect(response.status).toBe(400);
  });

  it("将自我封禁映射为公开 400 响应", async () => {
    createAdminSuspensionMock.mockResolvedValue({
      ok: false,
      reason: "cannot_suspend_self",
    });
    const { postAdminSuspensionRoute } = await import(
      "@/lib/api/routes/admin-suspensions"
    );

    const response = await postAdminSuspensionRoute(
      new Request("https://example.test/api/admin/suspensions", {
        body: JSON.stringify({ userId: "admin-1" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
    );

    await expect(response.json()).resolves.toEqual({
      error: "Admins cannot suspend themselves",
    });
    expect(response.status).toBe(400);
  });
});
