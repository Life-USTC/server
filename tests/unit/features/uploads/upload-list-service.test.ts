import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  pendingAggregateMock,
  pendingDeleteManyMock,
  uploadAggregateMock,
  uploadCountMock,
  uploadFindManyMock,
  withUserDbContextMock,
} = vi.hoisted(() => ({
  pendingAggregateMock: vi.fn(),
  pendingDeleteManyMock: vi.fn(),
  uploadAggregateMock: vi.fn(),
  uploadCountMock: vi.fn(),
  uploadFindManyMock: vi.fn(),
  withUserDbContextMock: vi.fn(),
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
  withUserDbContext: withUserDbContextMock,
}));

import { listUploads } from "@/features/uploads/server/upload-service";

describe("listUploads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadFindManyMock.mockResolvedValue([]);
    uploadCountMock.mockResolvedValue(3);
    uploadAggregateMock.mockResolvedValue({ _sum: { size: 80 } });
    pendingAggregateMock.mockResolvedValue({ _sum: { size: 20 } });
    withUserDbContextMock.mockImplementation((_userId, action) =>
      action({
        upload: {
          aggregate: uploadAggregateMock,
          count: uploadCountMock,
          findMany: uploadFindManyMock,
        },
        uploadPending: { aggregate: pendingAggregateMock },
      }),
    );
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
    expect(withUserDbContextMock).toHaveBeenCalledWith(
      "user-1",
      expect.any(Function),
    );
  });

  it("applies owner and column predicates before pagination and count while usage stays unfiltered", async () => {
    await listUploads(
      "user-1",
      { pageSize: 20, skip: 20 },
      {
        filename: "report",
        size: "100",
        sizeOp: "between",
        sizeMax: "500",
        createdAt: "2026-10-24",
        createdAtOp: "gte",
      },
    );
    const where = {
      userId: "user-1",
      filename: { contains: "report", mode: "insensitive" },
      size: { gte: 100, lte: 500 },
      createdAt: { gte: new Date("2026-10-23T16:00:00Z") },
    };
    expect(uploadFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where, skip: 20, take: 20 }),
    );
    expect(uploadCountMock).toHaveBeenCalledWith({ where });
    expect(uploadAggregateMock).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      _sum: { size: true },
    });
  });
});
