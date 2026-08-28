import { beforeEach, describe, expect, it, vi } from "vitest";

const { fireAuditLogMock, runSerializableTransactionMock, tx } = vi.hoisted(
  () => ({
    fireAuditLogMock: vi.fn(),
    runSerializableTransactionMock: vi.fn(),
    tx: { $queryRaw: vi.fn() },
  }),
);

vi.mock("@/lib/db/serializable-transaction", () => ({
  runSerializableTransaction: runSerializableTransactionMock,
}));

vi.mock("@/lib/audit/write-audit-log", () => ({
  fireAuditLog: fireAuditLogMock,
}));

vi.mock("@/lib/db/auth-prisma", () => ({
  authPrisma: { boundary: "auth" },
}));

describe("account deletion database boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runSerializableTransactionMock.mockImplementation((action) => action(tx));
    tx.$queryRaw.mockResolvedValue([{ status: "deleted" }]);
    fireAuditLogMock.mockResolvedValue(undefined);
  });

  it("delegates gate, audit, anonymization, and deletion to one serializable function", async () => {
    const { deleteOwnAccount } = await import(
      "@/features/settings/server/account-deletion-service"
    );

    await expect(
      deleteOwnAccount("user-1", {
        channel: "system",
        requestId: "request-1",
        sessionId: "session-1",
      }),
    ).resolves.toEqual({ ok: true });

    expect(runSerializableTransactionMock).toHaveBeenCalledOnce();
    expect(runSerializableTransactionMock).toHaveBeenCalledWith(
      expect.any(Function),
      "Failed to delete account",
      { boundary: "auth" },
    );
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(fireAuditLogMock).not.toHaveBeenCalled();
  });

  it("does not duplicate the denied audit written by the database function", async () => {
    tx.$queryRaw.mockResolvedValue([{ status: "cannot_remove_last_admin" }]);
    const { deleteOwnAccount } = await import(
      "@/features/settings/server/account-deletion-service"
    );

    await expect(
      deleteOwnAccount("admin-1", {
        channel: "web",
        sessionId: "session-admin-1",
      }),
    ).resolves.toEqual({ ok: false, reason: "cannot_remove_last_admin" });
    expect(fireAuditLogMock).not.toHaveBeenCalled();
  });
});
