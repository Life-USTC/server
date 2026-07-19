import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  deleteStorageObjectMock,
  getViewerContextMock,
  headStorageObjectMock,
  pendingDeleteManyMock,
  pendingFindManyMock,
  pendingFindUniqueMock,
  uploadFindUniqueMock,
} = vi.hoisted(() => ({
  deleteStorageObjectMock: vi.fn(),
  getViewerContextMock: vi.fn(),
  headStorageObjectMock: vi.fn(),
  pendingDeleteManyMock: vi.fn(),
  pendingFindManyMock: vi.fn(),
  pendingFindUniqueMock: vi.fn(),
  uploadFindUniqueMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    upload: {
      findUnique: uploadFindUniqueMock,
    },
    uploadPending: {
      deleteMany: pendingDeleteManyMock,
      findMany: pendingFindManyMock,
      findUnique: pendingFindUniqueMock,
    },
  },
}));

vi.mock("@/lib/auth/viewer-context", () => ({
  getViewerContext: getViewerContextMock,
}));

vi.mock("@/lib/storage/r2-object", () => ({
  deleteStorageObject: deleteStorageObjectMock,
  headStorageObject: headStorageObjectMock,
}));

import {
  completeOwnedUploadSession,
  createOwnedUploadSession,
} from "@/features/uploads/server/upload-service";

describe("owned upload workflow service", () => {
  beforeEach(() => {
    getViewerContextMock.mockResolvedValue({
      isAuthenticated: true,
      isSuspended: false,
    });
    pendingDeleteManyMock.mockResolvedValue({ count: 0 });
    pendingFindManyMock.mockResolvedValue([]);
    pendingFindUniqueMock.mockResolvedValue(null);
    uploadFindUniqueMock.mockResolvedValue(null);
    deleteStorageObjectMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("blocks suspended users before creating a quota reservation", async () => {
    getViewerContextMock.mockResolvedValue({
      isAuthenticated: true,
      isSuspended: true,
      suspensionReason: "spam",
    });

    await expect(
      createOwnedUploadSession({
        origin: "https://life.example",
        upload: {
          contentType: "text/plain",
          filename: "test.txt",
          size: 12,
        },
        userId: "user-1",
      }),
    ).resolves.toEqual({
      ok: false,
      error: "suspended",
      reason: "spam",
    });
    expect(pendingDeleteManyMock).not.toHaveBeenCalled();
  });

  it("rejects a key outside the authenticated user's namespace", async () => {
    await expect(
      completeOwnedUploadSession("user-1", {
        filename: "test.txt",
        key: "uploads/user-2/test.txt",
      }),
    ).resolves.toEqual({ ok: false, error: "forbidden" });
    expect(pendingFindUniqueMock).not.toHaveBeenCalled();
    expect(deleteStorageObjectMock).not.toHaveBeenCalled();
  });

  it("cleans an expired workflow object before preserving the stable error", async () => {
    pendingFindUniqueMock.mockResolvedValue({
      expiresAt: new Date(0),
      key: "uploads/user-1/test.txt",
      size: 12,
      userId: "user-1",
    });

    await expect(
      completeOwnedUploadSession("user-1", {
        filename: "test.txt",
        key: "uploads/user-1/test.txt",
      }),
    ).rejects.toMatchObject({ code: "Upload session expired" });
    expect(deleteStorageObjectMock).toHaveBeenCalledWith(
      "uploads/user-1/test.txt",
    );
    expect(pendingDeleteManyMock).toHaveBeenCalledWith({
      where: {
        key: "uploads/user-1/test.txt",
        userId: "user-1",
      },
    });
    expect(deleteStorageObjectMock.mock.invocationCallOrder[0]).toBeLessThan(
      pendingDeleteManyMock.mock.invocationCallOrder[0],
    );
  });

  it("preserves an expired pending upload on R2 failure and retries cleanup", async () => {
    pendingFindUniqueMock.mockResolvedValue({
      expiresAt: new Date(0),
      key: "uploads/user-1/test.txt",
      size: 12,
      userId: "user-1",
    });
    deleteStorageObjectMock.mockRejectedValueOnce(
      new Error("R2 delete unavailable"),
    );
    headStorageObjectMock.mockRejectedValueOnce(
      new Error("R2 head unavailable"),
    );

    await expect(
      completeOwnedUploadSession("user-1", {
        filename: "test.txt",
        key: "uploads/user-1/test.txt",
      }),
    ).resolves.toEqual({
      ok: false,
      error: "storage_delete_failed",
    });
    expect(pendingDeleteManyMock).not.toHaveBeenCalled();

    await expect(
      completeOwnedUploadSession("user-1", {
        filename: "test.txt",
        key: "uploads/user-1/test.txt",
      }),
    ).rejects.toMatchObject({ code: "Upload session expired" });
    expect(deleteStorageObjectMock).toHaveBeenCalledTimes(2);
    expect(pendingDeleteManyMock).toHaveBeenCalledTimes(1);
  });
});
