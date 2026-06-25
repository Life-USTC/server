import { beforeEach, describe, expect, it, vi } from "vitest";

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
      action({ user: prismaMock.user }),
    );
    prismaMock.user.count.mockReset();
    prismaMock.user.findUnique.mockReset();
    prismaMock.user.update.mockReset();
    prismaMock.userSuspension.create.mockReset();
    vi.resetModules();
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
});
