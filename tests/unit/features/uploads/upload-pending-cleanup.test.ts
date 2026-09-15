import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanupStaleUploadPendingStorage,
  UPLOAD_PENDING_CLEANUP_BATCH_SIZE,
  UPLOAD_PENDING_CLEANUP_LEASE_SECONDS,
} from "@/features/uploads/server/upload-pending-cleanup";

const { deleteStorageObjectMock, logAppEventMock } = vi.hoisted(() => ({
  deleteStorageObjectMock: vi.fn(),
  logAppEventMock: vi.fn(),
}));

vi.mock("@/lib/storage/r2-object", () => ({
  deleteStorageObject: deleteStorageObjectMock,
}));

vi.mock("@/lib/log/app-logger", () => ({
  logAppEvent: logAppEventMock,
}));

describe("upload pending storage cleanup", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("claims rows through the security-definer function and finalizes after R2 delete", async () => {
    const now = new Date("2026-07-30T12:00:00.000Z");
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([
        {
          attemptId: "attempt-1",
          id: "pending-1",
          key: "uploads/user-1/file.txt",
          userId: "user-1",
        },
      ])
      .mockResolvedValueOnce([{ finalized: true }]);
    deleteStorageObjectMock.mockResolvedValue(undefined);

    await expect(
      cleanupStaleUploadPendingStorage({ $queryRaw: queryRaw } as never, now),
    ).resolves.toEqual({
      claimed: 1,
      completed: 1,
      failed: 0,
      retried: 0,
      skipped: 0,
    });

    expect(deleteStorageObjectMock).toHaveBeenCalledWith(
      "uploads/user-1/file.txt",
    );
    const claimQuery = queryRaw.mock.calls[0]?.[0] as {
      sql: string;
      values: unknown[];
    };
    expect(claimQuery.sql).toContain(
      "FROM public.claim_upload_pending_storage_cleanup(",
    );
    expect(claimQuery.values).toEqual([
      now,
      UPLOAD_PENDING_CLEANUP_BATCH_SIZE,
      UPLOAD_PENDING_CLEANUP_LEASE_SECONDS,
    ]);
    expect(logAppEventMock).not.toHaveBeenCalled();
  });

  it("extends the cleanup lease when R2 deletion fails", async () => {
    const now = new Date("2026-07-30T12:00:00.000Z");
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([
        {
          attemptId: "attempt-1",
          id: "pending-1",
          key: "uploads/user-1/file.txt",
          userId: "user-1",
        },
      ])
      .mockResolvedValueOnce([{ released: true }]);
    deleteStorageObjectMock.mockRejectedValue(new Error("r2 unavailable"));

    await expect(
      cleanupStaleUploadPendingStorage({ $queryRaw: queryRaw } as never, now),
    ).resolves.toEqual({
      claimed: 1,
      completed: 0,
      failed: 0,
      retried: 1,
      skipped: 0,
    });

    expect(logAppEventMock).toHaveBeenCalledOnce();
    expect(logAppEventMock).toHaveBeenCalledWith(
      "warn",
      "Upload pending storage cleanup could not delete object",
      {
        event: "upload-pending-cleanup.storage-delete-failed",
        outcome: "retry",
        source: "upload-pending-cleanup",
      },
      expect.any(Error),
    );
    expect(logAppEventMock.mock.calls[0]?.[2]).not.toHaveProperty("key");
    expect(logAppEventMock.mock.calls[0]?.[2]).not.toHaveProperty("userId");
  });

  it("logs safe context when cleanup finalization fails", async () => {
    const now = new Date("2026-07-30T12:00:00.000Z");
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([
        {
          attemptId: "attempt-1",
          id: "pending-1",
          key: "uploads/user-secret/file.txt",
          userId: "user-secret",
        },
      ])
      .mockRejectedValueOnce(new Error("database unavailable"))
      .mockResolvedValueOnce([{ released: true }]);
    deleteStorageObjectMock.mockResolvedValue(undefined);

    await expect(
      cleanupStaleUploadPendingStorage({ $queryRaw: queryRaw } as never, now),
    ).resolves.toEqual({
      claimed: 1,
      completed: 0,
      failed: 0,
      retried: 1,
      skipped: 0,
    });

    expect(logAppEventMock).toHaveBeenCalledWith(
      "error",
      "Upload pending storage cleanup failed",
      {
        event: "upload-pending-cleanup.failed",
        outcome: "retry",
        source: "upload-pending-cleanup",
      },
      expect.any(Error),
    );
    expect(logAppEventMock.mock.calls[0]?.[2]).not.toHaveProperty("key");
    expect(logAppEventMock.mock.calls[0]?.[2]).not.toHaveProperty("userId");
  });
});
