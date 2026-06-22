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

describe("admin homework delete route", () => {
  afterEach(() => {
    deleteHomeworkMock.mockReset();
    withAdminApiRouteMock.mockClear();
    vi.resetModules();
  });

  it("maps missing homework to 404", async () => {
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

  it("maps permission failures to 403", async () => {
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
});
