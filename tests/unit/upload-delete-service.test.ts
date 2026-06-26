import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteOwnedUpload } from "@/features/uploads/server/upload-service";

const {
  deleteStorageObjectMock,
  fireAuditLogMock,
  getViewerContextMock,
  logAppEventMock,
  uploadDeleteMock,
  uploadFindFirstMock,
} = vi.hoisted(() => ({
  deleteStorageObjectMock: vi.fn(),
  fireAuditLogMock: vi.fn(),
  getViewerContextMock: vi.fn(),
  logAppEventMock: vi.fn(),
  uploadDeleteMock: vi.fn(),
  uploadFindFirstMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    upload: {
      delete: uploadDeleteMock,
      findFirst: uploadFindFirstMock,
    },
  },
}));

vi.mock("@/lib/storage/r2-object", () => ({
  deleteStorageObject: deleteStorageObjectMock,
  headStorageObject: vi.fn(),
}));

vi.mock("@/lib/audit/write-audit-log", () => ({
  fireAuditLog: fireAuditLogMock,
}));

vi.mock("@/lib/auth/viewer-context", () => ({
  getViewerContext: getViewerContextMock,
}));

vi.mock("@/lib/log/app-logger", () => ({
  logAppEvent: logAppEventMock,
}));

const upload = {
  id: "upload-1",
  key: "uploads/user-1/object.txt",
  size: 42,
};

describe("deleteOwnedUpload", () => {
  beforeEach(() => {
    getViewerContextMock.mockResolvedValue({
      isAuthenticated: true,
      isSuspended: false,
    });
    uploadFindFirstMock.mockResolvedValue(upload);
    deleteStorageObjectMock.mockResolvedValue(undefined);
    uploadDeleteMock.mockResolvedValue(upload);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("deletes the storage object before deleting upload metadata", async () => {
    const result = await deleteOwnedUpload({
      audit: { source: "mcp" },
      id: upload.id,
      userId: "user-1",
    });

    expect(result).toEqual({
      ok: true,
      deletedId: upload.id,
      deletedSize: upload.size,
    });
    expect(deleteStorageObjectMock).toHaveBeenCalledWith(upload.key);
    expect(uploadDeleteMock).toHaveBeenCalledWith({ where: { id: upload.id } });
    expect(deleteStorageObjectMock.mock.invocationCallOrder[0]).toBeLessThan(
      uploadDeleteMock.mock.invocationCallOrder[0],
    );
    expect(fireAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "upload_delete",
        metadata: { key: upload.key, size: upload.size, source: "mcp" },
        targetId: upload.id,
        targetType: "upload",
        userId: "user-1",
      }),
    );
  });

  it("preserves upload metadata when storage deletion fails", async () => {
    const storageError = new Error("R2 unavailable");
    deleteStorageObjectMock.mockRejectedValue(storageError);

    const result = await deleteOwnedUpload({
      id: upload.id,
      userId: "user-1",
    });

    expect(result).toEqual({
      ok: false,
      error: "storage_delete_failed",
    });
    expect(uploadDeleteMock).not.toHaveBeenCalled();
    expect(fireAuditLogMock).not.toHaveBeenCalled();
    expect(logAppEventMock).toHaveBeenCalledWith(
      "error",
      "R2 object deletion failed; upload record preserved",
      { source: "upload" },
      storageError,
    );
  });
});
