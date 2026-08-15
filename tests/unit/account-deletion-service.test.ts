import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  fireAuditLogMock,
  runSerializableTransactionMock,
  withUserDbContextMock,
  tx,
  appTx,
} = vi.hoisted(() => ({
  fireAuditLogMock: vi.fn(),
  runSerializableTransactionMock: vi.fn(),
  withUserDbContextMock: vi.fn(),
  tx: {
    $queryRaw: vi.fn().mockResolvedValue([{ anonymized: 0n }]),
    auditLog: {
      updateMany: vi.fn(() => {
        throw new Error(
          "account deletion must rely on the AuditLog foreign key",
        );
      }),
    },
    user: {
      count: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
    },
    userSuspension: {
      updateMany: vi.fn(() => {
        throw new Error(
          "account deletion must rely on the UserSuspension foreign keys",
        );
      }),
    },
  },
  appTx: {
    busUserPreference: { deleteMany: vi.fn() },
    commentReaction: { deleteMany: vi.fn() },
    dashboardLinkClick: { deleteMany: vi.fn() },
    dashboardLinkPin: { deleteMany: vi.fn() },
    homeworkCompletion: { deleteMany: vi.fn() },
    todo: { deleteMany: vi.fn() },
    upload: { deleteMany: vi.fn() },
    uploadPending: { deleteMany: vi.fn() },
  },
}));

vi.mock("@/lib/db/serializable-transaction", () => ({
  runSerializableTransaction: runSerializableTransactionMock,
}));

vi.mock("@/lib/audit/write-audit-log", () => ({
  fireAuditLog: fireAuditLogMock,
}));

vi.mock("@/lib/db/auth-prisma", () => ({
  authPrisma: { boundary: "auth" },
}));

vi.mock("@/lib/db/prisma", () => ({
  withUserDbContext: withUserDbContextMock,
}));

describe("account deletion database privileges", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runSerializableTransactionMock
      .mockImplementationOnce((action) => action(tx))
      .mockImplementationOnce((action) => action(tx));
    withUserDbContextMock.mockImplementation((_userId, action) =>
      action(appTx),
    );
    tx.user.findUnique.mockResolvedValue({ id: "user-1", isAdmin: false });
    tx.user.delete.mockResolvedValue({ id: "user-1" });
    fireAuditLogMock.mockResolvedValue(undefined);
  });

  it("anonymizes generic account targets before auth user deletion", async () => {
    const { deleteOwnAccount } = await import(
      "@/features/settings/server/account-deletion-service"
    );

    await expect(
      deleteOwnAccount("user-1", { channel: "system" }),
    ).resolves.toEqual({ ok: true });

    expect(runSerializableTransactionMock).toHaveBeenNthCalledWith(
      1,
      expect.any(Function),
      "Failed to delete account",
      { boundary: "auth" },
    );
    expect(withUserDbContextMock).toHaveBeenCalledWith(
      "user-1",
      expect.any(Function),
    );
    expect(appTx.todo.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
    });
    expect(runSerializableTransactionMock).toHaveBeenNthCalledWith(
      2,
      expect.any(Function),
      "Failed to delete account",
      { boundary: "auth" },
    );
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: "user-1" } });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.auditLog.updateMany).not.toHaveBeenCalled();
    expect(tx.userSuspension.updateMany).not.toHaveBeenCalled();
    expect(fireAuditLogMock).toHaveBeenCalledWith({
      action: "account_delete",
      channel: "system",
      metadata: { selfService: true },
      targetType: "user",
    });
  });
});
