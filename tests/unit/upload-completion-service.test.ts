import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { uploadConfig } from "@/features/uploads/lib/upload-config";
import {
  completeUploadSession,
  deleteOwnedUpload,
} from "@/features/uploads/server/upload-service";

const {
  deleteStorageObjectMock,
  fireAuditLogMock,
  getViewerContextMock,
  headStorageObjectMock,
  pendingAggregateMock,
  pendingDeleteManyMock,
  pendingFindUniqueMock,
  runSerializableTransactionMock,
  txPendingAggregateMock,
  txPendingDeleteManyMock,
  txPendingFindUniqueMock,
  txUploadAggregateMock,
  txUploadCreateMock,
  txUploadFindUniqueMock,
  uploadAggregateMock,
  uploadDeleteMock,
  uploadFindFirstMock,
  uploadFindUniqueMock,
} = vi.hoisted(() => ({
  deleteStorageObjectMock: vi.fn(),
  fireAuditLogMock: vi.fn(),
  getViewerContextMock: vi.fn(),
  headStorageObjectMock: vi.fn(),
  pendingAggregateMock: vi.fn(),
  pendingDeleteManyMock: vi.fn(),
  pendingFindUniqueMock: vi.fn(),
  runSerializableTransactionMock: vi.fn(),
  txPendingAggregateMock: vi.fn(),
  txPendingDeleteManyMock: vi.fn(),
  txPendingFindUniqueMock: vi.fn(),
  txUploadAggregateMock: vi.fn(),
  txUploadCreateMock: vi.fn(),
  txUploadFindUniqueMock: vi.fn(),
  uploadAggregateMock: vi.fn(),
  uploadDeleteMock: vi.fn(),
  uploadFindFirstMock: vi.fn(),
  uploadFindUniqueMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    upload: {
      aggregate: uploadAggregateMock,
      delete: uploadDeleteMock,
      findFirst: uploadFindFirstMock,
      findUnique: uploadFindUniqueMock,
    },
    uploadPending: {
      aggregate: pendingAggregateMock,
      deleteMany: pendingDeleteManyMock,
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

vi.mock("@/lib/audit/write-audit-log", () => ({
  fireAuditLog: fireAuditLogMock,
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
    runSerializableTransactionMock.mockImplementation(async (action) =>
      action(txPrisma),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("validates the uploaded object before opening the serializable transaction", async () => {
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

  it("deletes pending quota outside the transaction when object validation fails", async () => {
    headStorageObjectMock.mockResolvedValue({ size: 0 });

    await expect(
      completeUploadSession(USER_ID, {
        filename: "test.txt",
        key: KEY,
      }),
    ).rejects.toMatchObject({ code: "Uploaded object missing" });

    expect(runSerializableTransactionMock).not.toHaveBeenCalled();
    expect(pendingDeleteManyMock).toHaveBeenLastCalledWith({
      where: { key: KEY, userId: USER_ID },
    });
  });

  it("returns a concurrently completed upload instead of validating storage again", async () => {
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

  it("commits pending cleanup when the reservation expires before the transaction recheck", async () => {
    const expiringPending = {
      expiresAt: new Date(FIXED_NOW.getTime() + 1_000),
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
    expect(txPendingDeleteManyMock).toHaveBeenCalledWith({
      where: { key: KEY, userId: USER_ID },
    });
    expect(txUploadCreateMock).not.toHaveBeenCalled();
  });

  it("commits pending cleanup when quota validation fails in the transaction", async () => {
    txUploadAggregateMock.mockResolvedValue({
      _sum: { size: uploadConfig.totalQuotaBytes },
    });

    await expect(
      completeUploadSession(USER_ID, {
        filename: "test.txt",
        key: KEY,
      }),
    ).rejects.toMatchObject({ code: "Quota exceeded" });

    expect(txPendingDeleteManyMock).toHaveBeenCalledWith({
      where: { key: KEY, userId: USER_ID },
    });
    expect(txUploadCreateMock).not.toHaveBeenCalled();
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
    uploadDeleteMock.mockResolvedValue({});
    deleteStorageObjectMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("waits for upload delete audit scheduling before returning", async () => {
    const auditWrite = deferred<void>();
    fireAuditLogMock.mockReturnValue(auditWrite.promise);
    const settled = vi.fn();

    const result = deleteOwnedUpload({
      id: "upload-1",
      userId: USER_ID,
    });
    result.then(settled);

    await vi.waitFor(() => expect(fireAuditLogMock).toHaveBeenCalled());
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
