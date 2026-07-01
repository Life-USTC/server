import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteOwnedUpload } from "@/features/uploads/server/upload-service";

const {
  auditLogCreateMock,
  deleteStorageObjectMock,
  getViewerContextMock,
  headStorageObjectMock,
  logAppEventMock,
  uploadDeleteMock,
  uploadFindFirstMock,
  uploadTransactionMock,
} = vi.hoisted(() => ({
  auditLogCreateMock: vi.fn(),
  deleteStorageObjectMock: vi.fn(),
  getViewerContextMock: vi.fn(),
  headStorageObjectMock: vi.fn(),
  logAppEventMock: vi.fn(),
  uploadDeleteMock: vi.fn(),
  uploadFindFirstMock: vi.fn(),
  uploadTransactionMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: uploadTransactionMock,
    auditLog: {
      create: auditLogCreateMock,
    },
    upload: {
      delete: uploadDeleteMock,
      findFirst: uploadFindFirstMock,
    },
  },
}));

vi.mock("@/lib/storage/r2-object", () => ({
  deleteStorageObject: deleteStorageObjectMock,
  headStorageObject: headStorageObjectMock,
}));

vi.mock("@/lib/auth/viewer-context", () => ({
  getViewerContext: getViewerContextMock,
}));

vi.mock("@/lib/log/app-logger", () => ({
  logAppEvent: logAppEventMock,
}));

vi.mock("@/lib/metrics/observability-metrics", () => ({
  recordAuditWriteMetric: vi.fn(),
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
    headStorageObjectMock.mockResolvedValue({ size: upload.size });
    uploadDeleteMock.mockResolvedValue(upload);
    auditLogCreateMock.mockResolvedValue({});
    uploadTransactionMock.mockImplementation(async (action) =>
      action({
        auditLog: {
          create: auditLogCreateMock,
        },
        upload: {
          delete: uploadDeleteMock,
          findFirst: uploadFindFirstMock,
        },
      }),
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("先删除存储对象再删除上传元数据", async () => {
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
    expect(auditLogCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "upload_delete",
        metadata: { key: upload.key, size: upload.size, source: "mcp" },
        targetId: upload.id,
        targetType: "upload",
        userId: "user-1",
      }),
    });
  });

  it("在存储删除后暴露审计失败而不是丢弃审计记录", async () => {
    const auditError = new Error("audit unavailable");
    auditLogCreateMock.mockRejectedValueOnce(auditError);

    await expect(
      deleteOwnedUpload({
        id: upload.id,
        userId: "user-1",
      }),
    ).rejects.toThrow(auditError);

    expect(deleteStorageObjectMock).toHaveBeenCalledWith(upload.key);
    expect(uploadDeleteMock).toHaveBeenCalledWith({ where: { id: upload.id } });
    expect(auditLogCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "upload_delete",
        targetId: upload.id,
        targetType: "upload",
        userId: "user-1",
      }),
    });
  });

  it("存储删除失败时保留上传元数据", async () => {
    const storageError = new Error("R2 unavailable");
    deleteStorageObjectMock.mockRejectedValue(storageError);
    headStorageObjectMock.mockResolvedValue({ size: upload.size });

    const result = await deleteOwnedUpload({
      id: upload.id,
      userId: "user-1",
    });

    expect(result).toEqual({
      ok: false,
      error: "storage_delete_failed",
    });
    expect(uploadDeleteMock).not.toHaveBeenCalled();
    expect(auditLogCreateMock).not.toHaveBeenCalled();
    expect(logAppEventMock).toHaveBeenCalledWith(
      "error",
      "R2 object deletion failed; upload record preserved",
      { source: "upload" },
      storageError,
    );
  });

  it("存储对象已不存在时允许删除过期上传元数据", async () => {
    deleteStorageObjectMock.mockRejectedValue(new Error("R2 missing"));
    headStorageObjectMock.mockResolvedValue({ size: 0 });

    const result = await deleteOwnedUpload({
      id: upload.id,
      userId: "user-1",
    });

    expect(result).toEqual({
      ok: true,
      deletedId: upload.id,
      deletedSize: upload.size,
    });
    expect(headStorageObjectMock).toHaveBeenCalledWith(upload.key);
    expect(uploadDeleteMock).toHaveBeenCalledWith({ where: { id: upload.id } });
    expect(auditLogCreateMock).toHaveBeenCalled();
    expect(logAppEventMock).not.toHaveBeenCalled();
  });
});
