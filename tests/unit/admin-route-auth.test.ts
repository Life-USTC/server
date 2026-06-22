import { afterEach, describe, expect, it, vi } from "vitest";

const { resolveAdminByUserIdMock, resolveApiUserIdMock } = vi.hoisted(() => ({
  resolveAdminByUserIdMock: vi.fn(),
  resolveApiUserIdMock: vi.fn(),
}));

vi.mock("@/features/admin/server/admin-api", () => ({
  resolveAdminByUserId: resolveAdminByUserIdMock,
}));

vi.mock("@/lib/auth/api-auth", () => ({
  resolveApiUserId: resolveApiUserIdMock,
}));

describe("admin route auth", () => {
  afterEach(() => {
    resolveAdminByUserIdMock.mockReset();
    resolveApiUserIdMock.mockReset();
    vi.resetModules();
  });

  it("returns 401 when no API user is authenticated", async () => {
    resolveApiUserIdMock.mockResolvedValue(null);
    resolveAdminByUserIdMock.mockResolvedValue(null);
    const { requireAdminRequest } = await import(
      "@/lib/api/routes/admin-route-auth"
    );

    const response = await requireAdminRequest(
      new Request("https://example.test/api/admin/homeworks/homework-1"),
    );

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(401);
    expect(resolveAdminByUserIdMock).toHaveBeenCalledWith(null);
  });

  it("returns 401 when the authenticated user is not an admin", async () => {
    resolveApiUserIdMock.mockResolvedValue("user-1");
    resolveAdminByUserIdMock.mockResolvedValue(null);
    const { requireAdminRequest } = await import(
      "@/lib/api/routes/admin-route-auth"
    );

    const response = await requireAdminRequest(
      new Request("https://example.test/api/admin/homeworks/homework-1"),
    );

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(401);
    expect(resolveAdminByUserIdMock).toHaveBeenCalledWith("user-1");
  });
});
