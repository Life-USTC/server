import { afterAll, describe, expect, it } from "vitest";
import { createAdminSuspension } from "@/features/admin/server/admin-api-service";
import { upsertDescriptionContent } from "@/features/descriptions/server/description-upsert";
import { deleteOwnAccount } from "@/features/settings/server/account-deletion-service";
import { prisma } from "@/lib/db/prisma";

function marker(prefix: string) {
  return `[integration-test] ${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function waitForAuditLogCount(targetId: string, expected: number) {
  let count = 0;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    count = await prisma.auditLog.count({ where: { targetId } });
    if (count >= expected) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  expect(count).toBeGreaterThanOrEqual(expected);
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe("collaborative data invariants", () => {
  it("prevents direct duplicate open suspensions for one user", async () => {
    const prefix = marker("suspension-unique");
    const user = await prisma.user.create({
      data: {
        email: `${prefix}-user@example.test`,
        name: "Suspension Unique User",
      },
      select: { id: true },
    });
    const suspension = await prisma.userSuspension.create({
      data: {
        userId: user.id,
        reason: prefix,
      },
      select: { id: true },
    });

    try {
      await expect(
        prisma.userSuspension.create({
          data: {
            userId: user.id,
            reason: `${prefix} duplicate`,
          },
        }),
      ).rejects.toThrow();
    } finally {
      await prisma.userSuspension.deleteMany({
        where: { id: suspension.id },
      });
      await prisma.user.deleteMany({ where: { id: user.id } });
    }
  });

  it("creates a replacement suspension while closing the previous open row", async () => {
    const prefix = marker("suspension-replace");
    const [admin, user] = await Promise.all([
      prisma.user.create({
        data: {
          email: `${prefix}-admin@example.test`,
          name: "Suspension Admin",
          isAdmin: true,
        },
        select: { id: true },
      }),
      prisma.user.create({
        data: {
          email: `${prefix}-user@example.test`,
          name: "Suspension Replacement User",
        },
        select: { id: true },
      }),
    ]);
    const previousSuspension = await prisma.userSuspension.create({
      data: {
        userId: user.id,
        createdById: admin.id,
        reason: `${prefix} previous`,
      },
      select: { id: true },
    });

    try {
      const result = await createAdminSuspension(admin.id, {
        userId: user.id,
        reason: `${prefix} current`,
      });

      expect(result.ok).toBe(true);
      await waitForAuditLogCount(user.id, 1);
      const suspensions = await prisma.userSuspension.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "asc" },
        select: { id: true, liftedAt: true, reason: true },
      });
      expect(suspensions).toHaveLength(2);
      expect(
        suspensions.filter((suspension) => suspension.liftedAt === null),
      ).toHaveLength(1);
      expect(
        suspensions.find(
          (suspension) => suspension.id === previousSuspension.id,
        )?.liftedAt,
      ).toBeInstanceOf(Date);
      expect(suspensions.at(-1)?.reason).toBe(`${prefix} current`);
    } finally {
      await prisma.userSuspension.deleteMany({
        where: { userId: user.id },
      });
      await prisma.auditLog.deleteMany({
        where: { targetId: user.id, targetType: "user" },
      });
      await prisma.user.deleteMany({
        where: { id: { in: [admin.id, user.id] } },
      });
    }
  });

  it("deletes accounts while anonymizing audit rows and issued suspensions", async () => {
    const prefix = marker("account-delete");
    const [remainingAdmin, deletingAdmin, suspendedUser] = await Promise.all([
      prisma.user.create({
        data: {
          email: `${prefix}-remaining-admin@example.test`,
          name: "Remaining Admin",
          isAdmin: true,
        },
        select: { id: true },
      }),
      prisma.user.create({
        data: {
          email: `${prefix}-deleting-admin@example.test`,
          name: "Deleting Admin",
          isAdmin: true,
        },
        select: { id: true },
      }),
      prisma.user.create({
        data: {
          email: `${prefix}-suspended@example.test`,
          name: "Suspended User",
        },
        select: { id: true },
      }),
    ]);
    const auditLog = await prisma.auditLog.create({
      data: {
        action: "comment_create",
        userId: deletingAdmin.id,
        targetId: prefix,
        targetType: "integration-test",
      },
      select: { id: true },
    });
    const suspension = await prisma.userSuspension.create({
      data: {
        userId: suspendedUser.id,
        createdById: deletingAdmin.id,
        liftedById: deletingAdmin.id,
        liftedAt: new Date(),
        reason: prefix,
      },
      select: { id: true },
    });

    try {
      await expect(deleteOwnAccount(deletingAdmin.id)).resolves.toEqual({
        ok: true,
      });

      await expect(
        prisma.user.findUnique({ where: { id: deletingAdmin.id } }),
      ).resolves.toBeNull();
      await expect(
        prisma.auditLog.findUnique({
          where: { id: auditLog.id },
          select: { userId: true },
        }),
      ).resolves.toEqual({ userId: null });
      await expect(
        prisma.userSuspension.findUnique({
          where: { id: suspension.id },
          select: { createdById: true, liftedById: true, userId: true },
        }),
      ).resolves.toEqual({
        createdById: null,
        liftedById: null,
        userId: suspendedUser.id,
      });
    } finally {
      await prisma.userSuspension.deleteMany({ where: { id: suspension.id } });
      await prisma.auditLog.deleteMany({ where: { id: auditLog.id } });
      await prisma.user.deleteMany({
        where: { id: { in: [remainingAdmin.id, suspendedUser.id] } },
      });
    }
  });

  it("keeps concurrent first description writes stable and records edit history", async () => {
    const prefix = marker("description-race");
    const user = await prisma.user.create({
      data: {
        email: `${prefix}-writer@example.test`,
        name: "Description Writer",
      },
      select: { id: true },
    });
    const teacher = await prisma.teacher.create({
      data: {
        code: prefix,
        nameCn: prefix,
      },
      select: { id: true },
    });
    const contents = Array.from(
      { length: 6 },
      (_, index) => `${prefix} content ${index}`,
    );

    try {
      const results = await Promise.all(
        contents.map((content) =>
          upsertDescriptionContent({
            auditMetadata: { source: "integration-test" },
            content,
            targetId: teacher.id,
            targetType: "teacher",
            userId: user.id,
          }),
        ),
      );

      expect(results.every((result) => result.ok)).toBe(true);
      const descriptionIds = new Set(
        results.map((result) => (result.ok ? result.id : null)),
      );
      expect(descriptionIds.size).toBe(1);
      const description = await prisma.description.findUniqueOrThrow({
        where: { teacherId: teacher.id },
        select: { id: true },
      });
      const edits = await prisma.descriptionEdit.findMany({
        where: { descriptionId: description.id },
        orderBy: { createdAt: "asc" },
        select: { previousContent: true },
      });
      expect(edits).toHaveLength(contents.length);
      expect(
        edits.filter((edit) => edit.previousContent === null),
      ).toHaveLength(1);
      await waitForAuditLogCount(description.id, contents.length);
    } finally {
      const description = await prisma.description.findUnique({
        where: { teacherId: teacher.id },
        select: { id: true },
      });
      if (description) {
        await prisma.auditLog.deleteMany({
          where: { targetId: description.id, targetType: "description" },
        });
      }
      await prisma.teacher.deleteMany({ where: { id: teacher.id } });
      await prisma.user.deleteMany({ where: { id: user.id } });
    }
  });
});
