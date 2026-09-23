import { afterEach, describe, expect, it, vi } from "vitest";

const { deleteHomeworkMock, withAdminApiRouteMock } = vi.hoisted(() => ({
  deleteHomeworkMock: vi.fn(),
  withAdminApiRouteMock: vi.fn(
    async (
      _request: Request,
      _message: string,
      handler: (admin: { userId: string }) => Promise<Response>,
    ) => handler({ userId: "admin-1" }),
  ),
}));

vi.mock("@/features/homeworks/server/homework-mutations", () => ({
  deleteHomework: deleteHomeworkMock,
}));

vi.mock("@/lib/api/routes/admin-route-auth", () => ({
  withAdminApiRoute: withAdminApiRouteMock,
}));

describe("admin homework 删除路由", () => {
  afterEach(() => {
    deleteHomeworkMock.mockReset();
    withAdminApiRouteMock.mockClear();
    vi.resetModules();
  });

  it("将缺失的作业映射为 404", async () => {
    deleteHomeworkMock.mockResolvedValue({ ok: false, error: "not_found" });
    const { deleteAdminHomeworkRoute } = await import(
      "@/lib/api/routes/admin-homework-delete-route"
    );

    const response = await deleteAdminHomeworkRoute(
      new Request("https://example.test/api/admin/homeworks/homework-1", {
        method: "DELETE",
      }),
      { id: "homework-1" },
    );

    expect(response.status).toBe(404);
  });

  it("将权限失败映射为 403", async () => {
    deleteHomeworkMock.mockResolvedValue({ ok: false, error: "forbidden" });
    const { deleteAdminHomeworkRoute } = await import(
      "@/lib/api/routes/admin-homework-delete-route"
    );

    const response = await deleteAdminHomeworkRoute(
      new Request("https://example.test/api/admin/homeworks/homework-1", {
        method: "DELETE",
      }),
      { id: "homework-1" },
    );

    expect(response.status).toBe(403);
  });

  it("删除前透传管理员认证失败", async () => {
    withAdminApiRouteMock.mockResolvedValueOnce(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const { deleteAdminHomeworkRoute } = await import(
      "@/lib/api/routes/admin-homework-delete-route"
    );

    const response = await deleteAdminHomeworkRoute(
      new Request("https://example.test/api/admin/homeworks/homework-1", {
        method: "DELETE",
      }),
      { id: "homework-1" },
    );

    expect(response.status).toBe(401);
    expect(deleteHomeworkMock).not.toHaveBeenCalled();
  });
});
