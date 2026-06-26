import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  deleteOwnedUploadMock,
  getAuditRequestMetadataMock,
  listUploadsMock,
  renameOwnedUploadMock,
  requireAuthMock,
  requireWriteAuthMock,
} = vi.hoisted(() => ({
  deleteOwnedUploadMock: vi.fn(),
  getAuditRequestMetadataMock: vi.fn(),
  listUploadsMock: vi.fn(),
  renameOwnedUploadMock: vi.fn(),
  requireAuthMock: vi.fn(),
  requireWriteAuthMock: vi.fn(),
}));

vi.mock("@/features/uploads/server/upload-service", () => ({
  deleteOwnedUpload: deleteOwnedUploadMock,
  listUploads: listUploadsMock,
  renameOwnedUpload: renameOwnedUploadMock,
}));

vi.mock("@/lib/auth/api-auth", () => ({
  requireAuth: requireAuthMock,
  requireWriteAuth: requireWriteAuthMock,
}));

vi.mock("@/lib/audit/write-audit-log", () => ({
  getAuditRequestMetadata: getAuditRequestMetadataMock,
}));

describe("upload management routes", () => {
  beforeEach(() => {
    requireWriteAuthMock.mockResolvedValue({ userId: "user-1" });
    getAuditRequestMetadataMock.mockReturnValue({
      ipAddress: "127.0.0.1",
      userAgent: "unit-test",
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("serializes storage cleanup failures without reporting delete success", async () => {
    deleteOwnedUploadMock.mockResolvedValue({
      ok: false,
      error: "storage_delete_failed",
    });
    const { deleteUploadRoute } = await import(
      "@/lib/api/routes/upload-management-routes"
    );

    const response = await deleteUploadRoute(
      new Request("https://example.test/api/uploads/upload-1", {
        method: "DELETE",
      }),
      { id: "upload-1" },
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to delete upload object",
    });
    expect(deleteOwnedUploadMock).toHaveBeenCalledWith({
      audit: { ipAddress: "127.0.0.1", userAgent: "unit-test" },
      id: "upload-1",
      userId: "user-1",
    });
  });
});
