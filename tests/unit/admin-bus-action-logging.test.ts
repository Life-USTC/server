import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  loadBusStaticPayloadMock,
  logServerActionErrorMock,
  requireAdminPageMock,
} = vi.hoisted(() => ({
  loadBusStaticPayloadMock: vi.fn(),
  logServerActionErrorMock: vi.fn(),
  requireAdminPageMock: vi.fn(),
}));

vi.mock("@/features/admin/server/admin-page-data", () => ({
  getAdminBusPage: vi.fn(),
  requireAdminPage: requireAdminPageMock,
}));

vi.mock("@/features/bus/lib/bus-static-source", () => ({
  loadBusStaticPayload: loadBusStaticPayloadMock,
}));

vi.mock("@/features/bus/server/bus-import", () => ({
  importBusStaticPayload: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));

vi.mock("@/lib/log/app-logger", () => ({
  logServerActionError: logServerActionErrorMock,
}));

describe("admin bus action error logging", () => {
  beforeEach(() => {
    loadBusStaticPayloadMock.mockReset();
    logServerActionErrorMock.mockReset();
    requireAdminPageMock.mockReset().mockResolvedValue(undefined);
  });

  it("logs import failures without returning internal details", async () => {
    loadBusStaticPayloadMock.mockRejectedValue(
      new Error("database connection detail"),
    );
    const { adminBusActions } = await import(
      "@/features/admin/server/admin-bus-page-server"
    );

    const result = await adminBusActions.importStatic({
      locals: {
        locale: "en-us",
        requestId: "request-import",
      },
      request: new Request("https://life.example/admin/bus", {
        method: "POST",
      }),
    } as never);

    expect(result).toMatchObject({ status: 500 });
    expect(JSON.stringify(result)).not.toContain("database connection detail");
    expect(logServerActionErrorMock).toHaveBeenCalledWith(
      "admin.bus.import-static.failed",
      expect.any(Error),
      {
        action: "import-static",
        requestId: "request-import",
        route: "/admin/bus",
      },
    );
  });
});
