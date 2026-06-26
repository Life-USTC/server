import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fireAuditLogMock, getAdminUserListItemMock, prismaMock } = vi.hoisted(
  () => ({
    fireAuditLogMock: vi.fn(),
    getAdminUserListItemMock: vi.fn(),
    prismaMock: {
      $transaction: vi.fn(),
      user: {
        count: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      userSuspension: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
    },
  }),
);

vi.mock("@/features/admin/server/admin-user-read-model", () => ({
  getAdminUserListItem: getAdminUserListItemMock,
}));

vi.mock("@/lib/audit/write-audit-log", () => ({
  fireAuditLog: fireAuditLogMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: prismaMock,
}));

describe("admin API service", () => {
  beforeEach(() => {
    fireAuditLogMock.mockReset();
    getAdminUserListItemMock.mockReset();
    prismaMock.$transaction.mockReset();
    prismaMock.$transaction.mockImplementation(async (action) =>
      action({
        user: prismaMock.user,
        userSuspension: prismaMock.userSuspension,
      }),
    );
    prismaMock.user.count.mockReset();
    prismaMock.user.findUnique.mockReset();
    prismaMock.user.update.mockReset();
    prismaMock.userSuspension.create.mockReset();
    prismaMock.userSuspension.findUnique.mockReset();
    prismaMock.userSuspension.findUniqueOrThrow.mockReset();
    prismaMock.userSuspension.update.mockReset();
    prismaMock.userSuspension.updateMany.mockReset();
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects self-demotion before updating the user", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "admin-1",
      isAdmin: true,
    });
    const { updateAdminUser } = await import(
      "@/features/admin/server/admin-api-service"
    );

    const result = await updateAdminUser("admin-1", "admin-1", {
      isAdmin: false,
    });

    expect(result).toEqual({
      ok: false,
      reason: "cannot_demote_self",
    });
    expect(prismaMock.user.count).not.toHaveBeenCalled();
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("rejects removing the final remaining admin", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "admin-2",
      isAdmin: true,
    });
    prismaMock.user.count.mockResolvedValue(1);
    const { updateAdminUser } = await import(
      "@/features/admin/server/admin-api-service"
    );

    const result = await updateAdminUser("admin-1", "admin-2", {
      isAdmin: false,
    });

    expect(result).toEqual({
      ok: false,
      reason: "cannot_remove_last_admin",
    });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("retries final-admin demotion checks after serialization conflicts", async () => {
    prismaMock.$transaction
      .mockRejectedValueOnce({ code: "P2034" })
      .mockImplementationOnce(async (action) =>
        action({ user: prismaMock.user }),
      );
    prismaMock.user.findUnique.mockResolvedValue({
      id: "admin-2",
      isAdmin: true,
    });
    prismaMock.user.count.mockResolvedValue(1);
    const { updateAdminUser } = await import(
      "@/features/admin/server/admin-api-service"
    );

    const result = await updateAdminUser("admin-1", "admin-2", {
      isAdmin: false,
    });

    expect(result).toEqual({
      ok: false,
      reason: "cannot_remove_last_admin",
    });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(2);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("allows demoting another admin when at least one admin remains", async () => {
    const user = { id: "admin-2", isAdmin: false };
    prismaMock.user.findUnique.mockResolvedValue({
      id: "admin-2",
      isAdmin: true,
    });
    prismaMock.user.count.mockResolvedValue(2);
    prismaMock.user.update.mockResolvedValue({ id: "admin-2" });
    getAdminUserListItemMock.mockResolvedValue(user);
    const { updateAdminUser } = await import(
      "@/features/admin/server/admin-api-service"
    );

    const result = await updateAdminUser("admin-1", "admin-2", {
      isAdmin: false,
    });

    expect(result).toEqual({ ok: true, user });
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "admin-2" },
      data: { isAdmin: false },
      select: { id: true },
    });
  });

  it("rejects self-suspension before writing a suspension", async () => {
    const { createAdminSuspension } = await import(
      "@/features/admin/server/admin-api-service"
    );

    const result = await createAdminSuspension("admin-1", {
      userId: "admin-1",
    });

    expect(result).toEqual({
      ok: false,
      reason: "cannot_suspend_self",
    });
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.userSuspension.create).not.toHaveBeenCalled();
    expect(fireAuditLogMock).not.toHaveBeenCalled();
  });

  it("lifts an existing active suspension before creating the replacement", async () => {
    vi.useFakeTimers();
    const now = new Date("2026-06-26T01:02:03.000Z");
    vi.setSystemTime(now);
    const suspension = { id: "suspension-2", userId: "user-1" };
    prismaMock.user.findUnique.mockResolvedValue({ id: "user-1" });
    prismaMock.userSuspension.create.mockResolvedValue(suspension);
    const { createAdminSuspension } = await import(
      "@/features/admin/server/admin-api-service"
    );

    const result = await createAdminSuspension("admin-1", {
      note: "  note  ",
      reason: "  reason  ",
      userId: " user-1 ",
    });

    expect(result).toEqual({ ok: true, suspension });
    expect(prismaMock.userSuspension.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", liftedAt: null },
      data: { liftedAt: now, liftedById: "admin-1" },
    });
    expect(prismaMock.userSuspension.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        createdById: "admin-1",
        reason: "reason",
        note: "note",
        expiresAt: null,
      },
    });
    expect(fireAuditLogMock).toHaveBeenCalledWith({
      action: "admin_user_suspend",
      userId: "admin-1",
      targetId: "user-1",
      targetType: "user",
      metadata: { reason: "  reason  " },
    });
  });

  it("clears duplicate active suspensions when lifting the selected active row", async () => {
    vi.useFakeTimers();
    const now = new Date("2026-06-26T04:05:06.000Z");
    vi.setSystemTime(now);
    const suspension = { id: "suspension-1", userId: "user-1" };
    prismaMock.userSuspension.findUnique.mockResolvedValue({
      id: "suspension-1",
      liftedAt: null,
      userId: "user-1",
    });
    prismaMock.userSuspension.update.mockResolvedValue(suspension);
    prismaMock.userSuspension.findUniqueOrThrow.mockResolvedValue(suspension);
    const { liftAdminSuspension } = await import(
      "@/features/admin/server/admin-api-service"
    );

    const result = await liftAdminSuspension("admin-1", "suspension-1");

    expect(result).toEqual({ ok: true, suspension });
    expect(prismaMock.userSuspension.update).toHaveBeenCalledWith({
      where: { id: "suspension-1" },
      data: { liftedAt: now, liftedById: "admin-1" },
    });
    expect(prismaMock.userSuspension.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", liftedAt: null },
      data: { liftedAt: now, liftedById: "admin-1" },
    });
    expect(fireAuditLogMock).toHaveBeenCalledWith({
      action: "admin_user_unsuspend",
      userId: "admin-1",
      targetId: "user-1",
      targetType: "user",
      metadata: { suspensionId: "suspension-1" },
    });
  });

  it("does not clear a newer active suspension when re-lifting a history row", async () => {
    const liftedAt = new Date("2026-06-25T04:05:06.000Z");
    const suspension = { id: "suspension-1", userId: "user-1" };
    prismaMock.userSuspension.findUnique.mockResolvedValue({
      id: "suspension-1",
      liftedAt,
      userId: "user-1",
    });
    prismaMock.userSuspension.update.mockResolvedValue(suspension);
    const { liftAdminSuspension } = await import(
      "@/features/admin/server/admin-api-service"
    );

    const result = await liftAdminSuspension("admin-1", "suspension-1");

    expect(result).toEqual({ ok: true, suspension });
    expect(prismaMock.userSuspension.updateMany).not.toHaveBeenCalled();
  });
});
