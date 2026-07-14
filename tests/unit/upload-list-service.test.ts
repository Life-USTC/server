import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  pendingAggregateMock,
  pendingDeleteManyMock,
  uploadAggregateMock,
  uploadCountMock,
  uploadFindManyMock,
} = vi.hoisted(() => ({
  pendingAggregateMock: vi.fn(),
  pendingDeleteManyMock: vi.fn(),
  uploadAggregateMock: vi.fn(),
  uploadCountMock: vi.fn(),
  uploadFindManyMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    upload: {
      aggregate: uploadAggregateMock,
      count: uploadCountMock,
      findMany: uploadFindManyMock,
    },
    uploadPending: {
      aggregate: pendingAggregateMock,
      deleteMany: pendingDeleteManyMock,
    },
  },
}));

import { listUploads } from "@/features/uploads/server/upload-service";

describe("listUploads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadFindManyMock.mockResolvedValue([]);
    uploadCountMock.mockResolvedValue(3);
    uploadAggregateMock.mockResolvedValue({ _sum: { size: 80 } });
    pendingAggregateMock.mockResolvedValue({ _sum: { size: 20 } });
  });

  it("keeps GET read-only while excluding expired reservations from usage", async () => {
    await expect(
      listUploads("user-1", { pageSize: 2, skip: 2 }),
    ).resolves.toEqual(
      expect.objectContaining({ total: 3, uploads: [], usedBytes: 100 }),
    );

    expect(pendingDeleteManyMock).not.toHaveBeenCalled();
    expect(pendingAggregateMock).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        expiresAt: { gt: expect.any(Date) },
      },
      _sum: { size: true },
    });
    expect(uploadFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 2, take: 2 }),
    );
  });
});
