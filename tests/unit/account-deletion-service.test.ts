import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, txMock } = vi.hoisted(() => {
  const tx = {
    auditLog: {
      updateMany: vi.fn(),
    },
    user: {
      count: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
    },
    userSuspension: {
      updateMany: vi.fn(),
    },
  };

  return {
    prismaMock: {
      $transaction: vi.fn(),
    },
    txMock: tx,
  };
});

vi.mock("@/lib/db/prisma", () => ({
  prisma: prismaMock,
}));

describe("deleteOwnAccount", () => {
  beforeEach(() => {
    prismaMock.$transaction.mockReset();
    prismaMock.$transaction.mockImplementation(async (action) =>
      action(txMock),
    );
    txMock.auditLog.updateMany.mockReset();
    txMock.user.count.mockReset();
    txMock.user.delete.mockReset();
    txMock.user.findUnique.mockReset();
    txMock.userSuspension.updateMany.mockReset();
    vi.resetModules();
  });

  it("blocks deletion of the final admin before mutating retained records", async () => {
    txMock.user.findUnique.mockResolvedValue({ id: "admin-1", isAdmin: true });
    txMock.user.count.mockResolvedValue(1);
    const { deleteOwnAccount } = await import(
      "@/features/settings/server/account-deletion-service"
    );

    const result = await deleteOwnAccount("admin-1");

    expect(result).toEqual({
      ok: false,
      reason: "cannot_remove_last_admin",
    });
    expect(txMock.auditLog.updateMany).not.toHaveBeenCalled();
    expect(txMock.userSuspension.updateMany).not.toHaveBeenCalled();
    expect(txMock.user.delete).not.toHaveBeenCalled();
  });

  it("anonymizes retained audit and suspension actor rows before deleting the user", async () => {
    txMock.user.findUnique.mockResolvedValue({ id: "admin-2", isAdmin: true });
    txMock.user.count.mockResolvedValue(2);
    const { deleteOwnAccount } = await import(
      "@/features/settings/server/account-deletion-service"
    );

    const result = await deleteOwnAccount("admin-2");

    expect(result).toEqual({ ok: true });
    expect(txMock.auditLog.updateMany).toHaveBeenCalledWith({
      where: { userId: "admin-2" },
      data: { userId: null },
    });
    expect(txMock.userSuspension.updateMany).toHaveBeenCalledWith({
      where: { createdById: "admin-2" },
      data: { createdById: null },
    });
    expect(txMock.userSuspension.updateMany).toHaveBeenCalledWith({
      where: { liftedById: "admin-2" },
      data: { liftedById: null },
    });
    expect(txMock.user.delete).toHaveBeenCalledWith({
      where: { id: "admin-2" },
    });
  });
});
