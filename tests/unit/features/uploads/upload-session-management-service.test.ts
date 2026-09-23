import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { uploadConfig } from "@/features/uploads/lib/upload-config";

const mocks = vi.hoisted(() => ({
  getViewerContext: vi.fn(),
  withUserDbContext: vi.fn(),
  runSerializableTransaction: vi.fn(),
  buildUploadKey: vi.fn(),
  uploadAggregate: vi.fn(),
  pendingAggregate: vi.fn(),
  pendingFindMany: vi.fn(),
  pendingDeleteMany: vi.fn(),
  pendingCreate: vi.fn(),
  txQueryRaw: vi.fn(),
  uploadFindFirst: vi.fn(),
  uploadUpdate: vi.fn(),
  uploadDeleteMany: vi.fn(),
  queryRaw: vi.fn(),
  deleteStorageObject: vi.fn(),
  headStorageObject: vi.fn(),
  writeAuditLog: vi.fn(),
  logAppEvent: vi.fn(),
}));

vi.mock("@/lib/auth/viewer-context", () => ({
  getViewerContext: mocks.getViewerContext,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {},
  withUserDbContext: mocks.withUserDbContext,
}));

vi.mock("@/lib/db/serializable-transaction", () => ({
  runSerializableTransaction: mocks.runSerializableTransaction,
}));

vi.mock("@/lib/storage/upload-key", () => ({
  buildUploadKey: mocks.buildUploadKey,
}));

vi.mock("@/lib/storage/r2-object", () => ({
  deleteStorageObject: mocks.deleteStorageObject,
  headStorageObject: mocks.headStorageObject,
}));

vi.mock("@/lib/audit/write-audit-log", () => ({
  writeAuditLog: mocks.writeAuditLog,
}));

vi.mock("@/lib/log/app-logger", () => ({
  logAppEvent: mocks.logAppEvent,
}));

const USER_ID = "user-1";
const KEY = "uploads/user-1/generated-key";
const FIXED_NOW = new Date("2026-01-15T08:30:45.000Z");

const ownerTx = {
  upload: {
    findFirst: mocks.uploadFindFirst,
    update: mocks.uploadUpdate,
    deleteMany: mocks.uploadDeleteMany,
  },
  uploadPending: {
    findMany: mocks.pendingFindMany,
    deleteMany: mocks.pendingDeleteMany,
  },
  $queryRaw: mocks.queryRaw,
};

const serializableTx = {
  $queryRaw: mocks.txQueryRaw,
  upload: {
    aggregate: mocks.uploadAggregate,
  },
  uploadPending: {
    aggregate: mocks.pendingAggregate,
    create: mocks.pendingCreate,
  },
};

const managedUpload = {
  createdAt: FIXED_NOW,
  filename: "renamed.txt",
  id: "upload-1",
  key: KEY,
  size: 12,
};

describe("upload session creation and management", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    vi.resetAllMocks();

    mocks.getViewerContext.mockResolvedValue({
      isAuthenticated: true,
      isSuspended: false,
    });
    mocks.buildUploadKey.mockReturnValue(KEY);
    mocks.withUserDbContext.mockImplementation((_userId, action) =>
      action(ownerTx),
    );
    mocks.runSerializableTransaction.mockImplementation(async (action) =>
      action(serializableTx),
    );
    mocks.txQueryRaw.mockResolvedValue([]);
    mocks.uploadAggregate.mockResolvedValue({ _sum: { size: 10 } });
    mocks.pendingAggregate.mockResolvedValue({ _sum: { size: 5 } });
    mocks.pendingFindMany.mockResolvedValue([]);
    mocks.pendingDeleteMany.mockResolvedValue({ count: 0 });
    mocks.pendingCreate.mockResolvedValue({});
    mocks.uploadFindFirst.mockResolvedValue(null);
    mocks.uploadUpdate.mockResolvedValue(managedUpload);
    mocks.uploadDeleteMany.mockResolvedValue({ count: 1 });
    mocks.queryRaw.mockResolvedValue([]);
    mocks.deleteStorageObject.mockResolvedValue(undefined);
    mocks.headStorageObject.mockResolvedValue({ size: 0 });
    mocks.writeAuditLog.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("reserves quota, cleans stale reservations, and returns an expiring object URL", async () => {
    mocks.pendingFindMany.mockResolvedValue([
      { key: "uploads/user-1/expired-a" },
      { key: "uploads/user-1/expired-b" },
    ]);
    const { createOwnedUploadSession } = await import(
      "@/features/uploads/server/upload-create-session"
    );

    await expect(
      createOwnedUploadSession({
        origin: "https://life.example/base",
        upload: { contentType: "text/plain", filename: "test.txt", size: 7 },
        userId: USER_ID,
      }),
    ).resolves.toEqual({
      ok: true,
      session: {
        key: KEY,
        url: `https://life.example/api/workspace/uploads/object?key=${encodeURIComponent(KEY)}`,
        maxFileSizeBytes: uploadConfig.maxFileSizeBytes,
        quotaBytes: uploadConfig.totalQuotaBytes,
        usedBytes: 15,
      },
    });

    expect(mocks.pendingFindMany).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
        expiresAt: { lt: FIXED_NOW },
        phase: { in: ["reserved", "uploaded"] },
        OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: FIXED_NOW } }],
      },
      orderBy: [{ expiresAt: "asc" }, { key: "asc" }],
      select: { key: true },
      take: 25,
    });
    expect(mocks.pendingDeleteMany).toHaveBeenCalledWith({
      where: {
        key: { in: ["uploads/user-1/expired-a", "uploads/user-1/expired-b"] },
        userId: USER_ID,
        expiresAt: { lt: FIXED_NOW },
      },
    });
    expect(mocks.txQueryRaw).toHaveBeenCalledTimes(1);
    expect(mocks.pendingCreate).toHaveBeenCalledWith({
      data: {
        attemptId: expect.any(String),
        contentType: "text/plain",
        expiresAt: new Date(FIXED_NOW.getTime() + 300_000),
        filename: "test.txt",
        key: KEY,
        phase: "reserved",
        size: 7,
        userId: USER_ID,
      },
    });
  });

  it("rejects a reservation that would exceed the durable and pending quota", async () => {
    mocks.uploadAggregate.mockResolvedValue({
      _sum: { size: uploadConfig.totalQuotaBytes - 1 },
    });
    mocks.pendingAggregate.mockResolvedValue({ _sum: { size: 0 } });
    const { createUploadSession } = await import(
      "@/features/uploads/server/upload-create-session"
    );

    await expect(
      createUploadSession({
        origin: "https://life.example",
        upload: {
          contentType: "application/octet-stream",
          filename: "too-large.bin",
          size: 2,
        },
        userId: USER_ID,
      }),
    ).rejects.toMatchObject({ code: "Quota exceeded" });
    expect(mocks.pendingCreate).not.toHaveBeenCalled();
  });

  it("requires an authenticated unsuspended writer before creating a session", async () => {
    mocks.getViewerContext.mockResolvedValue({
      isAuthenticated: false,
      isSuspended: false,
    });
    const { createOwnedUploadSession } = await import(
      "@/features/uploads/server/upload-create-session"
    );

    await expect(
      createOwnedUploadSession({
        origin: "https://life.example",
        upload: { contentType: "text/plain", filename: "test.txt", size: 1 },
        userId: USER_ID,
      }),
    ).resolves.toEqual({ ok: false, error: "forbidden" });
    expect(mocks.pendingFindMany).not.toHaveBeenCalled();
    expect(mocks.pendingCreate).not.toHaveBeenCalled();
  });

  it("renames only an upload owned by the requesting user", async () => {
    const { renameOwnedUpload, renameUpload } = await import(
      "@/features/uploads/server/upload-manage"
    );
    mocks.uploadFindFirst.mockResolvedValueOnce(null);

    await expect(
      renameUpload({ filename: "new.txt", id: "missing", userId: USER_ID }),
    ).resolves.toBeNull();
    expect(mocks.uploadFindFirst).toHaveBeenCalledWith({
      where: { id: "missing", userId: USER_ID },
      select: { id: true },
    });

    mocks.uploadFindFirst.mockResolvedValueOnce({ id: "upload-1" });
    await expect(
      renameOwnedUpload({
        filename: "renamed.txt",
        id: "upload-1",
        userId: USER_ID,
      }),
    ).resolves.toEqual({ ok: true, upload: managedUpload });
    expect(mocks.uploadUpdate).toHaveBeenCalledWith({
      where: { id: "upload-1" },
      data: { filename: "renamed.txt" },
      select: {
        id: true,
        key: true,
        filename: true,
        size: true,
        createdAt: true,
      },
    });
  });

  it("returns explicit outcomes for deletion races and storage failures", async () => {
    const { deleteOwnedUpload } = await import(
      "@/features/uploads/server/upload-manage"
    );

    await expect(
      deleteOwnedUpload({ id: "missing", userId: USER_ID }),
    ).resolves.toEqual({ ok: false, error: "not_found" });

    const upload = { id: "upload-1", key: KEY, size: 12 };
    mocks.uploadFindFirst.mockResolvedValueOnce(upload);
    mocks.deleteStorageObject.mockRejectedValueOnce(new Error("R2 down"));
    mocks.headStorageObject.mockRejectedValueOnce(new Error("head failed"));
    await expect(
      deleteOwnedUpload({ id: upload.id, userId: USER_ID }),
    ).resolves.toEqual({ ok: false, error: "storage_delete_failed" });

    mocks.uploadFindFirst.mockResolvedValueOnce(upload);
    mocks.deleteStorageObject.mockResolvedValueOnce(undefined);
    mocks.uploadDeleteMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      deleteOwnedUpload({ id: upload.id, userId: USER_ID }),
    ).resolves.toEqual({ ok: false, error: "not_found" });
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("deletes storage and metadata together and records audit attribution", async () => {
    const { deleteOwnedUpload } = await import(
      "@/features/uploads/server/upload-manage"
    );
    const upload = { id: "upload-1", key: KEY, size: 12 };
    mocks.uploadFindFirst.mockResolvedValue(upload);

    await expect(
      deleteOwnedUpload({
        id: upload.id,
        userId: USER_ID,
        audit: {
          channel: "mcp",
          ipAddress: "127.0.0.1",
          requestId: "request-1",
          source: "mcp",
          subjectUserId: "subject-1",
          userAgent: "unit-test",
        },
      }),
    ).resolves.toEqual({ ok: true, deletedId: upload.id, deletedSize: 12 });
    expect(mocks.deleteStorageObject).toHaveBeenCalledWith(KEY);
    expect(mocks.uploadDeleteMany).toHaveBeenCalledWith({
      where: { id: upload.id, userId: USER_ID },
    });
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      {
        action: "upload_delete",
        channel: "mcp",
        ipAddress: "127.0.0.1",
        requestId: "request-1",
        subjectUserId: "subject-1",
        userAgent: "unit-test",
        userId: USER_ID,
        targetId: upload.id,
        targetType: "upload",
        metadata: { size: 12, source: "mcp" },
      },
      ownerTx,
    );
  });

  it("does not expose downloadable metadata to anonymous viewers", async () => {
    const { findDownloadableUpload } = await import(
      "@/features/uploads/server/upload-manage"
    );
    mocks.getViewerContext.mockResolvedValueOnce({
      isAuthenticated: false,
      isSuspended: false,
    });

    await expect(
      findDownloadableUpload("upload-1", USER_ID),
    ).resolves.toBeNull();
    expect(mocks.queryRaw).not.toHaveBeenCalled();
  });

  it("returns only the database download gate result for an authenticated viewer", async () => {
    const { findDownloadableUpload } = await import(
      "@/features/uploads/server/upload-manage"
    );
    const downloadable = {
      contentType: "text/plain",
      filename: "test.txt",
      key: KEY,
      userId: USER_ID,
    };
    mocks.queryRaw.mockResolvedValueOnce([downloadable]);

    await expect(findDownloadableUpload("upload-1", USER_ID)).resolves.toEqual(
      downloadable,
    );
    expect(mocks.getViewerContext).toHaveBeenCalledWith({
      includeAdmin: true,
      userId: USER_ID,
    });
    expect(mocks.queryRaw).toHaveBeenCalledTimes(1);
  });
});
