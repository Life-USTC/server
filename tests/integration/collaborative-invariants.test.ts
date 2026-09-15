import { afterAll, describe, expect, it } from "vitest";
import { createAdminSuspension } from "@/features/admin/server/admin-api-service";
import { upsertDescriptionContent } from "@/features/descriptions/server/description-upsert";
import { deleteOwnAccount } from "@/features/settings/server/account-deletion-service";
import { prisma as runtimePrisma } from "@/lib/db/prisma";
import { createFixturePrisma } from "../shared/prisma";

const fixturePrisma = createFixturePrisma();

function marker(prefix: string) {
  return `[integration-test] ${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function waitForAuditLogCount(targetId: string, expected: number) {
  let count = 0;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    count = await fixturePrisma.auditLog.count({ where: { targetId } });
    if (count >= expected) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  expect(count).toBeGreaterThanOrEqual(expected);
}

afterAll(async () => {
  await Promise.all([runtimePrisma.$disconnect(), fixturePrisma.$disconnect()]);
});

describe("协作数据不变量", () => {
  it("阻止同一用户的直接重复开放封禁", async () => {
    const prefix = marker("suspension-unique");
    const user = await fixturePrisma.user.create({
      data: {
        email: `${prefix}-user@example.test`,
        name: "Suspension Unique User",
      },
      select: { id: true },
    });
    const suspension = await fixturePrisma.userSuspension.create({
      data: {
        userId: user.id,
        reason: prefix,
      },
      select: { id: true },
    });

    try {
      await expect(
        fixturePrisma.userSuspension.create({
          data: {
            userId: user.id,
            reason: `${prefix} duplicate`,
          },
        }),
      ).rejects.toThrow();
    } finally {
      await fixturePrisma.userSuspension.deleteMany({
        where: { id: suspension.id },
      });
      await fixturePrisma.user.deleteMany({ where: { id: user.id } });
    }
  });

  it("创建替代封禁并关闭之前的开放记录", async () => {
    const prefix = marker("suspension-replace");
    const [admin, user] = await Promise.all([
      fixturePrisma.user.create({
        data: {
          email: `${prefix}-admin@example.test`,
          name: "Suspension Admin",
          isAdmin: true,
        },
        select: { id: true },
      }),
      fixturePrisma.user.create({
        data: {
          email: `${prefix}-user@example.test`,
          name: "Suspension Replacement User",
        },
        select: { id: true },
      }),
    ]);
    const previousSuspension = await fixturePrisma.userSuspension.create({
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
      const suspensions = await fixturePrisma.userSuspension.findMany({
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
      await fixturePrisma.userSuspension.deleteMany({
        where: { userId: user.id },
      });
      await fixturePrisma.auditLog.deleteMany({
        where: { targetId: user.id, targetType: "user" },
      });
      await fixturePrisma.user.deleteMany({
        where: { id: { in: [admin.id, user.id] } },
      });
    }
  });

  it("删除账户并匿名化审计行与已发出的封禁", async () => {
    const prefix = marker("account-delete");
    const [remainingAdmin, deletingAdmin, suspendedUser] = await Promise.all([
      fixturePrisma.user.create({
        data: {
          email: `${prefix}-remaining-admin@example.test`,
          name: "Remaining Admin",
          isAdmin: true,
        },
        select: { id: true },
      }),
      fixturePrisma.user.create({
        data: {
          email: `${prefix}-deleting-admin@example.test`,
          name: "Deleting Admin",
          isAdmin: true,
        },
        select: { id: true },
      }),
      fixturePrisma.user.create({
        data: {
          email: `${prefix}-suspended@example.test`,
          name: "Suspended User",
        },
        select: { id: true },
      }),
    ]);
    const [deletionSession, otherUser] = await Promise.all([
      fixturePrisma.session.create({
        data: {
          expires: new Date(Date.now() + 60 * 60 * 1000),
          sessionToken: crypto.randomUUID(),
          userId: deletingAdmin.id,
        },
        select: { id: true },
      }),
      fixturePrisma.user.create({
        data: {
          email: `${prefix}-other-user@example.test`,
          name: "Other User",
        },
        select: { id: true },
      }),
    ]);
    const auditLog = await fixturePrisma.auditLog.create({
      data: {
        action: "account_profile_update",
        userId: deletingAdmin.id,
        subjectUserId: deletingAdmin.id,
        targetId: deletingAdmin.id,
        targetType: "user",
      },
      select: { id: true },
    });
    const suspension = await fixturePrisma.userSuspension.create({
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
      await expect(
        deleteOwnAccount(otherUser.id, {
          channel: "system",
          sessionId: deletionSession.id,
        }),
      ).resolves.toEqual({ ok: false, reason: "unauthorized" });
      await expect(
        fixturePrisma.user.findUnique({ where: { id: otherUser.id } }),
      ).resolves.toMatchObject({ id: otherUser.id });

      await expect(
        deleteOwnAccount(deletingAdmin.id, {
          channel: "system",
          sessionId: deletionSession.id,
        }),
      ).resolves.toEqual({ ok: true });

      await expect(
        fixturePrisma.user.findUnique({ where: { id: deletingAdmin.id } }),
      ).resolves.toBeNull();
      await expect(
        fixturePrisma.auditLog.findUnique({
          where: { id: auditLog.id },
          select: { subjectUserId: true, targetId: true, userId: true },
        }),
      ).resolves.toEqual({ subjectUserId: null, targetId: null, userId: null });
      await expect(
        fixturePrisma.userSuspension.findUnique({
          where: { id: suspension.id },
          select: { createdById: true, liftedById: true, userId: true },
        }),
      ).resolves.toEqual({
        createdById: null,
        liftedById: null,
        userId: suspendedUser.id,
      });
    } finally {
      await fixturePrisma.userSuspension.deleteMany({
        where: { id: suspension.id },
      });
      await fixturePrisma.auditLog.deleteMany({
        where: {
          OR: [{ id: auditLog.id }, { targetId: otherUser.id }],
        },
      });
      await fixturePrisma.user.deleteMany({
        where: {
          id: { in: [remainingAdmin.id, suspendedUser.id, otherUser.id] },
        },
      });
    }
  });

  it("并发首次描述写入保持稳定并记录编辑历史", async () => {
    const prefix = marker("description-race");
    const user = await fixturePrisma.user.create({
      data: {
        email: `${prefix}-writer@example.test`,
        name: "Description Writer",
      },
      select: { id: true },
    });
    const teacher = await fixturePrisma.teacher.create({
      data: {
        code: prefix,
        jwId: 2_110_000_000 + (Date.now() % 10_000_000),
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
      const description = await fixturePrisma.description.findUniqueOrThrow({
        where: { teacherId: teacher.id },
        select: { id: true },
      });
      const edits = await fixturePrisma.descriptionEdit.findMany({
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
      const description = await fixturePrisma.description.findUnique({
        where: { teacherId: teacher.id },
        select: { id: true },
      });
      if (description) {
        await fixturePrisma.auditLog.deleteMany({
          where: { targetId: description.id, targetType: "description" },
        });
      }
      await fixturePrisma.teacher.deleteMany({ where: { id: teacher.id } });
      await fixturePrisma.user.deleteMany({ where: { id: user.id } });
    }
  });
});
