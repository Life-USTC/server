import { describe, expect } from "vitest";
import { createAdminSuspension } from "@/features/admin/server/admin-api-service";
import { upsertDescriptionContent } from "@/features/descriptions/server/description-upsert";
import { deleteOwnAccount } from "@/features/settings/server/account-deletion-service";
import { nodeProtocolTest as it } from "../shared/node-protocol-fixture";
import type { TestPrismaClient } from "../shared/prisma";

function marker(prefix: string) {
  return `[integration-test] ${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function expectAuditLogCount(
  fixturePrisma: TestPrismaClient,
  targetId: string,
  expected: number,
) {
  // Each production request has already drained its registered audit work.
  const count = await fixturePrisma.auditLog.count({ where: { targetId } });
  expect(count).toBeGreaterThanOrEqual(expected);
}

describe("协作数据不变量", () => {
  it("阻止同一用户的直接重复开放封禁", async ({
    isolatedDatabase: { owner: fixturePrisma },
    protocolRuntime,
  }) => {
    await protocolRuntime.run(async () => {
      const prefix = marker("suspension-unique");
      const { user } = await fixturePrisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: `${prefix}-user@example.test`,
            name: "Suspension Unique User",
          },
          select: { id: true },
        });
        await tx.userSuspension.create({
          data: {
            userId: user.id,
            reason: prefix,
          },
          select: { id: true },
        });

        return { user };
      });
      // Probe the database uniqueness constraint directly, independently of the service.
      await expect(
        fixturePrisma.userSuspension.create({
          data: {
            userId: user.id,
            reason: `${prefix} duplicate`,
          },
        }),
      ).rejects.toThrow();
    });
  });

  it("创建替代封禁并关闭之前的开放记录", async ({
    isolatedDatabase: { owner: fixturePrisma },
    protocolRuntime,
  }) => {
    await protocolRuntime.run(async () => {
      const prefix = marker("suspension-replace");
      const { admin, user, previousSuspension } =
        await fixturePrisma.$transaction(async (tx) => {
          const [admin, user] = await Promise.all([
            tx.user.create({
              data: {
                email: `${prefix}-admin@example.test`,
                name: "Suspension Admin",
                isAdmin: true,
              },
              select: { id: true },
            }),
            tx.user.create({
              data: {
                email: `${prefix}-user@example.test`,
                name: "Suspension Replacement User",
              },
              select: { id: true },
            }),
          ]);
          const previousSuspension = await tx.userSuspension.create({
            data: {
              userId: user.id,
              createdById: admin.id,
              reason: `${prefix} previous`,
            },
            select: { id: true },
          });

          return { admin, user, previousSuspension };
        });
      const result = await protocolRuntime.request(() =>
        createAdminSuspension(admin.id, {
          userId: user.id,
          reason: `${prefix} current`,
        }),
      );

      expect(result.ok).toBe(true);
      await expectAuditLogCount(fixturePrisma, user.id, 1);
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
    });
  });

  it("user.account-deletion-retention", async ({
    isolatedDatabase: { owner: fixturePrisma },
    protocolRuntime,
  }) => {
    await protocolRuntime.run(async () => {
      const prefix = marker("account-delete");
      const {
        deletingAdmin,
        suspendedUser,
        deletionSession,
        otherUser,
        auditLog,
        suspension,
      } = await fixturePrisma.$transaction(async (tx) => {
        const [, deletingAdmin, suspendedUser] = await Promise.all([
          tx.user.create({
            data: {
              email: `${prefix}-remaining-admin@example.test`,
              name: "Remaining Admin",
              isAdmin: true,
            },
            select: { id: true },
          }),
          tx.user.create({
            data: {
              email: `${prefix}-deleting-admin@example.test`,
              name: "Deleting Admin",
              isAdmin: true,
            },
            select: { id: true },
          }),
          tx.user.create({
            data: {
              email: `${prefix}-suspended@example.test`,
              name: "Suspended User",
            },
            select: { id: true },
          }),
        ]);
        const [deletionSession, otherUser] = await Promise.all([
          tx.session.create({
            data: {
              expires: new Date(Date.now() + 60 * 60 * 1000),
              sessionToken: crypto.randomUUID(),
              userId: deletingAdmin.id,
            },
            select: { id: true },
          }),
          tx.user.create({
            data: {
              email: `${prefix}-other-user@example.test`,
              name: "Other User",
            },
            select: { id: true },
          }),
        ]);
        const auditLog = await tx.auditLog.create({
          data: {
            action: "account_profile_update",
            userId: deletingAdmin.id,
            subjectUserId: deletingAdmin.id,
            targetId: deletingAdmin.id,
            targetType: "user",
          },
          select: { id: true },
        });
        const suspension = await tx.userSuspension.create({
          data: {
            userId: suspendedUser.id,
            createdById: deletingAdmin.id,
            liftedById: deletingAdmin.id,
            liftedAt: new Date(),
            reason: prefix,
          },
          select: { id: true },
        });

        return {
          deletingAdmin,
          suspendedUser,
          deletionSession,
          otherUser,
          auditLog,
          suspension,
        };
      });
      await expect(
        protocolRuntime.request(() =>
          deleteOwnAccount(otherUser.id, {
            channel: "system",
            sessionId: deletionSession.id,
          }),
        ),
      ).resolves.toEqual({ ok: false, reason: "unauthorized" });
      await expect(
        fixturePrisma.user.findUnique({ where: { id: otherUser.id } }),
      ).resolves.toMatchObject({ id: otherUser.id });

      await expect(
        protocolRuntime.request(() =>
          deleteOwnAccount(deletingAdmin.id, {
            channel: "system",
            sessionId: deletionSession.id,
            requestId: prefix,
          }),
        ),
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
      const success = await fixturePrisma.auditLog.findMany({
        where: {
          action: "account_delete",
          outcome: "success",
          requestId: prefix,
        },
      });
      expect(success).toHaveLength(1);
      expect(success[0]).toMatchObject({
        userId: null,
        subjectUserId: null,
        targetId: null,
      });
      expect(JSON.stringify(success)).not.toContain(deletingAdmin.id);
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
    });
  });

  it("并发首次描述写入保持稳定并记录编辑历史", async ({
    isolatedDatabase: { owner: fixturePrisma },
    protocolRuntime,
  }) => {
    await protocolRuntime.run(async () => {
      const prefix = marker("description-race");
      const { user, teacher, contents } = await fixturePrisma.$transaction(
        async (tx) => {
          const user = await tx.user.create({
            data: {
              email: `${prefix}-writer@example.test`,
              name: "Description Writer",
            },
            select: { id: true },
          });
          const teacher = await tx.teacher.create({
            data: {
              code: prefix,
              jwId: 1,
              nameCn: prefix,
            },
            select: { id: true },
          });
          const contents = Array.from(
            { length: 6 },
            (_, index) => `${prefix} content ${index}`,
          );

          return { user, teacher, contents };
        },
      );
      const results = await Promise.all(
        contents.map((content) =>
          protocolRuntime.request(() =>
            upsertDescriptionContent({
              auditMetadata: { source: "integration-test" },
              content,
              targetId: teacher.id,
              targetType: "teacher",
              userId: user.id,
            }),
          ),
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
      await expectAuditLogCount(fixturePrisma, description.id, contents.length);
    });
  });
});
