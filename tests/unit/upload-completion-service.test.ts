import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { uploadConfig } from "@/features/uploads/lib/upload-config";
import {
  completeOwnedUploadSession,
  completeUploadSession,
  deleteOwnedUpload,
} from "@/features/uploads/server/upload-service";

const {
  auditLogCreateMock,
  deleteStorageObjectMock,
  getViewerContextMock,
  headStorageObjectMock,
  pendingAggregateMock,
  pendingDeleteManyMock,
  pendingFindManyMock,
  pendingFindUniqueMock,
  runSerializableTransactionMock,
  txPendingAggregateMock,
  txPendingDeleteManyMock,
  txPendingFindUniqueMock,
  txPendingUpdateManyMock,
  txUploadAggregateMock,
  txUploadCreateMock,
  txUploadFindUniqueMock,
  uploadAggregateMock,
  uploadDeleteManyMock,
  uploadFindFirstMock,
  uploadFindUniqueMock,
  uploadTransactionMock,
} = vi.hoisted(() => ({
  auditLogCreateMock: vi.fn(),
  deleteStorageObjectMock: vi.fn(),
  getViewerContextMock: vi.fn(),
  headStorageObjectMock: vi.fn(),
  pendingAggregateMock: vi.fn(),
  pendingDeleteManyMock: vi.fn(),
  pendingFindManyMock: vi.fn(),
  pendingFindUniqueMock: vi.fn(),
  runSerializableTransactionMock: vi.fn(),
  txPendingAggregateMock: vi.fn(),
  txPendingDeleteManyMock: vi.fn(),
  txPendingFindUniqueMock: vi.fn(),
  txPendingUpdateManyMock: vi.fn(),
  txUploadAggregateMock: vi.fn(),
  txUploadCreateMock: vi.fn(),
  txUploadFindUniqueMock: vi.fn(),
  uploadAggregateMock: vi.fn(),
  uploadDeleteManyMock: vi.fn(),
  uploadFindFirstMock: vi.fn(),
  uploadFindUniqueMock: vi.fn(),
  uploadTransactionMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: uploadTransactionMock,
    auditLog: {
      create: auditLogCreateMock,
    },
    upload: {
      aggregate: uploadAggregateMock,
      deleteMany: uploadDeleteManyMock,
      findFirst: uploadFindFirstMock,
      findUnique: uploadFindUniqueMock,
    },
    uploadPending: {
      aggregate: pendingAggregateMock,
      deleteMany: pendingDeleteManyMock,
      findMany: pendingFindManyMock,
      findUnique: pendingFindUniqueMock,
    },
  },
}));

vi.mock("@/lib/db/serializable-transaction", () => ({
  runSerializableTransaction: runSerializableTransactionMock,
}));

vi.mock("@/lib/storage/r2-object", () => ({
  deleteStorageObject: deleteStorageObjectMock,
  headStorageObject: headStorageObjectMock,
}));

vi.mock("@/lib/auth/viewer-context", () => ({
  getViewerContext: getViewerContextMock,
}));

vi.mock("@/lib/log/app-logger", () => ({
  logAppEvent: vi.fn(),
}));

const FIXED_NOW = new Date("2026-01-15T00:00:00.000Z");
const KEY = "uploads/user-1/test.txt";
const USER_ID = "user-1";

const validPending = {
  expiresAt: new Date(FIXED_NOW.getTime() + 60_000),
  key: KEY,
  size: 10,
  userId: USER_ID,
};

const createdUpload = {
  createdAt: FIXED_NOW,
  filename: "test.txt",
  id: "upload-1",
  key: KEY,
  size: 10,
  userId: USER_ID,
};

const txPrisma = {
  upload: {
    aggregate: txUploadAggregateMock,
    create: txUploadCreateMock,
    findUnique: txUploadFindUniqueMock,
  },
  uploadPending: {
    aggregate: txPendingAggregateMock,
    deleteMany: txPendingDeleteManyMock,
    findUnique: txPendingFindUniqueMock,
    updateMany: txPendingUpdateManyMock,
  },
};

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}

describe("completeUploadSession", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);

    pendingDeleteManyMock.mockResolvedValue({ count: 0 });
    pendingFindManyMock.mockResolvedValue([]);
    pendingFindUniqueMock.mockResolvedValue(validPending);
    uploadFindUniqueMock.mockResolvedValue(null);

    headStorageObjectMock.mockResolvedValue({
      contentType: "text/plain",
      size: 10,
    });
    deleteStorageObjectMock.mockResolvedValue(undefined);

    txUploadFindUniqueMock.mockResolvedValue(null);
    txPendingFindUniqueMock.mockResolvedValue(validPending);
    txUploadAggregateMock.mockResolvedValue({ _sum: { size: 0 } });
    txPendingAggregateMock.mockResolvedValue({ _sum: { size: 0 } });
    txUploadCreateMock.mockResolvedValue(createdUpload);
    txPendingDeleteManyMock.mockResolvedValue({ count: 1 });
    txPendingUpdateManyMock.mockResolvedValue({ count: 1 });
    runSerializableTransactionMock.mockImplementation(async (action) =>
      action(txPrisma),
    );
    getViewerContextMock.mockResolvedValue({
      isAuthenticated: true,
      isSuspended: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("在开启可串行事务前校验已上传对象", async () => {
    const calls: string[] = [];
    headStorageObjectMock.mockImplementation(async () => {
      calls.push("head");
      return { contentType: "text/plain", size: 10 };
    });
    runSerializableTransactionMock.mockImplementation(async (action) => {
      calls.push("transaction");
      return action(txPrisma);
    });

    await expect(
      completeUploadSession(USER_ID, {
        filename: "test.txt",
        key: KEY,
      }),
    ).resolves.toMatchObject({
      upload: { id: "upload-1", key: KEY },
      usedBytes: 10,
    });

    expect(calls).toEqual(["head", "transaction"]);
    expect(txUploadCreateMock).toHaveBeenCalledWith({
      data: {
        contentType: "application/octet-stream",
        filename: "test.txt",
        key: KEY,
        size: 10,
        userId: USER_ID,
      },
    });
  });

  it("对象校验失败时保留待处理配额且不删除 R2", async () => {
    headStorageObjectMock.mockResolvedValue({ size: 0 });

    await expect(
      completeUploadSession(USER_ID, {
        filename: "test.txt",
        key: KEY,
      }),
    ).rejects.toMatchObject({ code: "Uploaded object missing" });

    expect(runSerializableTransactionMock).not.toHaveBeenCalled();
    expect(pendingDeleteManyMock).not.toHaveBeenCalled();
    expect(deleteStorageObjectMock).not.toHaveBeenCalled();
  });

  it("对象超过大小限制时保留待处理配额且不删除 R2", async () => {
    headStorageObjectMock.mockResolvedValue({
      size: uploadConfig.maxFileSizeBytes + 1,
    });

    await expect(
      completeUploadSession(USER_ID, {
        filename: "test.txt",
        key: KEY,
      }),
    ).rejects.toMatchObject({ code: "File too large" });

    expect(runSerializableTransactionMock).not.toHaveBeenCalled();
    expect(pendingDeleteManyMock).not.toHaveBeenCalled();
    expect(deleteStorageObjectMock).not.toHaveBeenCalled();
  });

  it("返回并发完成的上传而非再次校验存储", async () => {
    pendingFindUniqueMock.mockResolvedValue(null);
    uploadFindUniqueMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(createdUpload);
    uploadAggregateMock.mockResolvedValue({ _sum: { size: 10 } });
    pendingAggregateMock.mockResolvedValue({ _sum: { size: 0 } });

    await expect(
      completeUploadSession(USER_ID, {
        filename: "test.txt",
        key: KEY,
      }),
    ).resolves.toMatchObject({
      upload: { id: "upload-1", key: KEY },
      usedBytes: 10,
    });

    expect(headStorageObjectMock).not.toHaveBeenCalled();
    expect(runSerializableTransactionMock).not.toHaveBeenCalled();
    expect(pendingDeleteManyMock).toHaveBeenLastCalledWith({
      where: { key: KEY, userId: USER_ID },
    });
  });

  it("预留会话在事务重新检查前过期时保留待清理项", async () => {
    const expiringPending = {
      expiresAt: new Date(FIXED_NOW.getTime() + 1_000),
      key: KEY,
      size: 10,
      userId: USER_ID,
    };
    pendingFindUniqueMock.mockResolvedValue(expiringPending);
    txPendingFindUniqueMock.mockResolvedValue(expiringPending);
    headStorageObjectMock.mockImplementation(async () => {
      vi.setSystemTime(new Date(FIXED_NOW.getTime() + 2_000));
      return { contentType: "text/plain", size: 10 };
    });
    let transactionActionCompleted = false;
    runSerializableTransactionMock.mockImplementation(async (action) => {
      const result = await action(txPrisma);
      transactionActionCompleted = true;
      return result;
    });

    await expect(
      completeUploadSession(USER_ID, {
        filename: "test.txt",
        key: KEY,
      }),
    ).rejects.toMatchObject({ code: "Upload session expired" });

    expect(transactionActionCompleted).toBe(true);
    expect(txPendingDeleteManyMock).not.toHaveBeenCalled();
    expect(txUploadCreateMock).not.toHaveBeenCalled();
  });

  it("事务内配额校验失败时保留待清理项", async () => {
    txUploadAggregateMock.mockResolvedValue({
      _sum: { size: uploadConfig.totalQuotaBytes },
    });

    await expect(
      completeUploadSession(USER_ID, {
        filename: "test.txt",
        key: KEY,
      }),
    ).rejects.toMatchObject({ code: "Quota exceeded" });

    expect(txPendingDeleteManyMock).not.toHaveBeenCalled();
    expect(txPendingUpdateManyMock).toHaveBeenCalledWith({
      where: {
        key: KEY,
        userId: USER_ID,
        expiresAt: { gte: FIXED_NOW },
      },
      data: { expiresAt: new Date(FIXED_NOW.getTime() - 1) },
    });
    expect(txUploadCreateMock).not.toHaveBeenCalled();
  });

  it("可串行事务重试看到并发完成后不再清理 R2", async () => {
    txUploadAggregateMock.mockResolvedValue({
      _sum: { size: uploadConfig.totalQuotaBytes },
    });
    txUploadFindUniqueMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(createdUpload);
    runSerializableTransactionMock.mockImplementation(async (action) => {
      await action(txPrisma);
      return action(txPrisma);
    });

    await expect(
      completeOwnedUploadSession(USER_ID, {
        filename: "test.txt",
        key: KEY,
      }),
    ).resolves.toMatchObject({
      ok: true,
      completion: { upload: { id: "upload-1" } },
    });

    expect(txPendingUpdateManyMock).toHaveBeenCalledTimes(1);
    expect(deleteStorageObjectMock).not.toHaveBeenCalled();
  });

  it("限制过期 DB 清理批次且不触碰 R2", async () => {
    const staleKey = "uploads/user-1/stale.txt";
    pendingFindManyMock.mockResolvedValue([{ key: staleKey }]);

    await expect(
      completeUploadSession(USER_ID, {
        filename: "test.txt",
        key: KEY,
      }),
    ).resolves.toMatchObject({ upload: { id: "upload-1" } });

    expect(pendingFindManyMock).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
        expiresAt: { lt: FIXED_NOW },
        NOT: { key: KEY },
      },
      orderBy: [{ expiresAt: "asc" }, { key: "asc" }],
      select: { key: true },
      take: 25,
    });
    expect(pendingDeleteManyMock).toHaveBeenCalledWith({
      where: {
        key: { in: [staleKey] },
        userId: USER_ID,
        expiresAt: { lt: FIXED_NOW },
      },
    });
    expect(deleteStorageObjectMock).not.toHaveBeenCalled();
  });

  it("配额失败时仅过期待处理行且不触碰 R2", async () => {
    txUploadAggregateMock.mockResolvedValue({
      _sum: { size: uploadConfig.totalQuotaBytes },
    });

    await expect(
      completeOwnedUploadSession(USER_ID, {
        filename: "test.txt",
        key: KEY,
      }),
    ).rejects.toMatchObject({ code: "Quota exceeded" });
    expect(txPendingDeleteManyMock).not.toHaveBeenCalled();
    expect(txPendingUpdateManyMock).toHaveBeenCalledWith({
      where: {
        key: KEY,
        userId: USER_ID,
        expiresAt: { gte: FIXED_NOW },
      },
      data: { expiresAt: new Date(FIXED_NOW.getTime() - 1) },
    });
    expect(pendingDeleteManyMock).not.toHaveBeenCalled();
    expect(deleteStorageObjectMock).not.toHaveBeenCalled();
  });
});

describe("deleteOwnedUpload", () => {
  beforeEach(() => {
    getViewerContextMock.mockResolvedValue({
      isAuthenticated: true,
      isSuspended: false,
    });
    uploadFindFirstMock.mockResolvedValue({
      id: "upload-1",
      key: KEY,
      size: 10,
    });
    uploadDeleteManyMock.mockResolvedValue({ count: 1 });
    deleteStorageObjectMock.mockResolvedValue(undefined);
    auditLogCreateMock.mockResolvedValue({});
    uploadTransactionMock.mockImplementation(async (action) =>
      action({
        auditLog: {
          create: auditLogCreateMock,
        },
        upload: {
          deleteMany: uploadDeleteManyMock,
          findFirst: uploadFindFirstMock,
        },
      }),
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("在返回前等待上传删除审计写入", async () => {
    const auditWrite = deferred<void>();
    auditLogCreateMock.mockReturnValue(auditWrite.promise);
    const settled = vi.fn();

    const result = deleteOwnedUpload({
      id: "upload-1",
      userId: USER_ID,
    });
    result.then(settled);

    await vi.waitFor(() => expect(auditLogCreateMock).toHaveBeenCalled());
    expect(settled).not.toHaveBeenCalled();

    auditWrite.resolve();

    await expect(result).resolves.toEqual({
      ok: true,
      deletedId: "upload-1",
      deletedSize: 10,
    });
    expect(settled).toHaveBeenCalledWith({
      ok: true,
      deletedId: "upload-1",
      deletedSize: 10,
    });
  });
});
