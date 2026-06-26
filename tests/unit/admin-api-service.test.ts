import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  auditLogCreateMock,
  commentFindUniqueMock,
  commentUpdateMock,
  descriptionEditCreateMock,
  descriptionFindUniqueMock,
  descriptionUpdateMock,
  getAdminUserListItemMock,
  isPrismaUniqueConstraintErrorMock,
  prismaMock,
} = vi.hoisted(() => ({
  auditLogCreateMock: vi.fn(),
  commentFindUniqueMock: vi.fn(),
  commentUpdateMock: vi.fn(),
  descriptionEditCreateMock: vi.fn(),
  descriptionFindUniqueMock: vi.fn(),
  descriptionUpdateMock: vi.fn(),
  getAdminUserListItemMock: vi.fn(),
  isPrismaUniqueConstraintErrorMock: vi.fn(),
  prismaMock: {
    $transaction: vi.fn(),
    auditLog: {
      create: vi.fn(),
    },
    comment: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    description: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    descriptionEdit: {
      create: vi.fn(),
    },
    user: {
      count: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    userSuspension: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@/features/admin/server/admin-user-read-model", () => ({
  getAdminUserListItem: getAdminUserListItemMock,
}));

vi.mock("@/lib/db/prisma-errors", () => ({
  isPrismaUniqueConstraintError: isPrismaUniqueConstraintErrorMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/metrics/observability-metrics", () => ({
  recordAuditWriteMetric: vi.fn(),
}));

describe("admin API service", () => {
  beforeEach(() => {
    auditLogCreateMock.mockReset();
    commentFindUniqueMock.mockReset();
    commentUpdateMock.mockReset();
    descriptionEditCreateMock.mockReset();
    descriptionFindUniqueMock.mockReset();
    descriptionUpdateMock.mockReset();
    getAdminUserListItemMock.mockReset();
    isPrismaUniqueConstraintErrorMock.mockReset();
    isPrismaUniqueConstraintErrorMock.mockReturnValue(false);
    prismaMock.auditLog.create = auditLogCreateMock;
    prismaMock.comment.findUnique = commentFindUniqueMock;
    prismaMock.comment.update = commentUpdateMock;
    prismaMock.description.findUnique = descriptionFindUniqueMock;
    prismaMock.description.update = descriptionUpdateMock;
    prismaMock.descriptionEdit.create = descriptionEditCreateMock;
    prismaMock.$transaction.mockReset();
    prismaMock.$transaction.mockImplementation(async (action) =>
      action({
        auditLog: prismaMock.auditLog,
        comment: prismaMock.comment,
        description: prismaMock.description,
        descriptionEdit: prismaMock.descriptionEdit,
        user: prismaMock.user,
        userSuspension: prismaMock.userSuspension,
      }),
    );
    auditLogCreateMock.mockResolvedValue({});
    prismaMock.user.count.mockReset();
    prismaMock.user.findUnique.mockReset();
    prismaMock.user.update.mockReset();
    prismaMock.userSuspension.create.mockReset();
    prismaMock.userSuspension.findUnique.mockReset();
    prismaMock.userSuspension.update.mockReset();
    prismaMock.userSuspension.updateMany.mockReset();
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

  it("maps username uniqueness races to username_taken", async () => {
    const uniqueConflict = new Error("unique conflict");
    isPrismaUniqueConstraintErrorMock.mockReturnValueOnce(true);
    prismaMock.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "user-1",
        isAdmin: false,
      });
    prismaMock.user.update.mockRejectedValueOnce(uniqueConflict);
    const { updateAdminUser } = await import(
      "@/features/admin/server/admin-api-service"
    );

    const result = await updateAdminUser("admin-1", "user-1", {
      username: "taken-name",
    });

    expect(result).toEqual({
      ok: false,
      reason: "username_taken",
    });
    expect(isPrismaUniqueConstraintErrorMock).toHaveBeenCalledWith(
      uniqueConflict,
    );
    expect(getAdminUserListItemMock).not.toHaveBeenCalled();
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
    expect(prismaMock.userSuspension.updateMany).not.toHaveBeenCalled();
    expect(auditLogCreateMock).not.toHaveBeenCalled();
  });

  it("closes existing open suspensions before creating the current suspension", async () => {
    const createdSuspension = {
      id: "suspension-new",
      userId: "user-1",
      reason: "fresh reason",
      note: null,
      expiresAt: null,
    };
    prismaMock.user.findUnique.mockResolvedValue({ id: "user-1" });
    prismaMock.userSuspension.create.mockResolvedValue(createdSuspension);
    const { createAdminSuspension } = await import(
      "@/features/admin/server/admin-api-service"
    );

    const result = await createAdminSuspension("admin-1", {
      userId: " user-1 ",
      reason: " fresh reason ",
      note: " ",
    });

    expect(result).toEqual({ ok: true, suspension: createdSuspension });
    expect(prismaMock.userSuspension.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", liftedAt: null },
      data: {
        liftedAt: expect.any(Date),
        liftedById: "admin-1",
      },
    });
    expect(prismaMock.userSuspension.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        createdById: "admin-1",
        reason: "fresh reason",
        note: null,
        expiresAt: null,
      },
    });
    expect(auditLogCreateMock).toHaveBeenCalledWith({
      data: {
        action: "admin_user_suspend",
        userId: "admin-1",
        targetId: "user-1",
        targetType: "user",
        metadata: { reason: " fresh reason " },
      },
    });
  });

  it("rejects suspension creation when the required audit write fails", async () => {
    const auditError = new Error("audit unavailable");
    prismaMock.user.findUnique.mockResolvedValue({ id: "user-1" });
    prismaMock.userSuspension.create.mockResolvedValue({
      id: "suspension-1",
      userId: "user-1",
    });
    auditLogCreateMock.mockRejectedValueOnce(auditError);
    const { createAdminSuspension } = await import(
      "@/features/admin/server/admin-api-service"
    );

    await expect(
      createAdminSuspension("admin-1", { userId: "user-1" }),
    ).rejects.toThrow(auditError);

    expect(auditLogCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "admin_user_suspend",
        targetId: "user-1",
        targetType: "user",
        userId: "admin-1",
      }),
    });
  });

  it("retries suspension creation after an open-suspension uniqueness race", async () => {
    const uniqueConflict = new Error("unique conflict");
    const createdSuspension = {
      id: "suspension-after-retry",
      userId: "user-1",
    };
    isPrismaUniqueConstraintErrorMock.mockReturnValueOnce(true);
    prismaMock.$transaction
      .mockRejectedValueOnce(uniqueConflict)
      .mockImplementationOnce(async (action) =>
        action({
          auditLog: prismaMock.auditLog,
          user: prismaMock.user,
          userSuspension: prismaMock.userSuspension,
        }),
      );
    prismaMock.user.findUnique.mockResolvedValue({ id: "user-1" });
    prismaMock.userSuspension.create.mockResolvedValue(createdSuspension);
    const { createAdminSuspension } = await import(
      "@/features/admin/server/admin-api-service"
    );

    const result = await createAdminSuspension("admin-1", {
      userId: "user-1",
    });

    expect(result).toEqual({ ok: true, suspension: createdSuspension });
    expect(isPrismaUniqueConstraintErrorMock).toHaveBeenCalledWith(
      uniqueConflict,
    );
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(2);
  });

  it("lifts every open suspension for the requested suspension user", async () => {
    const liftedSuspension = {
      id: "suspension-1",
      userId: "user-1",
      liftedAt: new Date("2026-06-26T04:00:00.000Z"),
      liftedById: "admin-1",
    };
    prismaMock.userSuspension.findUnique.mockResolvedValue({
      id: "suspension-1",
      liftedAt: null,
      userId: "user-1",
    });
    prismaMock.userSuspension.update.mockResolvedValue(liftedSuspension);
    const { liftAdminSuspension } = await import(
      "@/features/admin/server/admin-api-service"
    );

    const result = await liftAdminSuspension("admin-1", "suspension-1");

    expect(result).toEqual({ ok: true, suspension: liftedSuspension });
    expect(prismaMock.userSuspension.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", liftedAt: null },
      data: {
        liftedAt: expect.any(Date),
        liftedById: "admin-1",
      },
    });
    expect(prismaMock.userSuspension.update).toHaveBeenCalledWith({
      where: { id: "suspension-1" },
      data: {
        liftedAt: expect.any(Date),
        liftedById: "admin-1",
      },
    });
    expect(auditLogCreateMock).toHaveBeenCalledWith({
      data: {
        action: "admin_user_unsuspend",
        userId: "admin-1",
        targetId: "user-1",
        targetType: "user",
        metadata: { suspensionId: "suspension-1" },
      },
    });
  });

  it("rejects comment moderation when the required audit write fails", async () => {
    const auditError = new Error("audit unavailable");
    commentFindUniqueMock.mockResolvedValue({ id: "comment-1" });
    commentUpdateMock.mockResolvedValue({ id: "comment-1", status: "deleted" });
    auditLogCreateMock.mockRejectedValueOnce(auditError);
    const { moderateComment } = await import(
      "@/features/admin/server/admin-api-service"
    );

    await expect(
      moderateComment("admin-1", "comment-1", {
        moderationNote: "spam",
        status: "deleted",
      }),
    ).rejects.toThrow(auditError);

    expect(commentUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "comment-1" } }),
    );
    expect(auditLogCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "admin_comment_moderate",
        metadata: { moderationNote: "spam", status: "deleted" },
        targetId: "comment-1",
        targetType: "comment",
        userId: "admin-1",
      }),
    });
  });

  it("rejects description moderation when the required audit write fails", async () => {
    const auditError = new Error("audit unavailable");
    descriptionFindUniqueMock.mockResolvedValue({
      id: "description-1",
      content: "old content",
    });
    descriptionUpdateMock.mockResolvedValue({
      id: "description-1",
      content: "new content",
    });
    descriptionEditCreateMock.mockResolvedValue({});
    auditLogCreateMock.mockRejectedValueOnce(auditError);
    const { moderateDescription } = await import(
      "@/features/admin/server/admin-api-service"
    );

    await expect(
      moderateDescription("admin-1", "description-1", {
        content: "new content",
      }),
    ).rejects.toThrow(auditError);

    expect(descriptionEditCreateMock).toHaveBeenCalledWith({
      data: {
        descriptionId: "description-1",
        editorId: "admin-1",
        previousContent: "old content",
        nextContent: "new content",
      },
    });
    expect(auditLogCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "admin_description_moderate",
        metadata: {
          previousContent: "old content",
          nextContent: "new content",
        },
        targetId: "description-1",
        targetType: "description",
        userId: "admin-1",
      }),
    });
  });
});
