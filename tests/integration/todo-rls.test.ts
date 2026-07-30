import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, withUserDbContext } from "@/lib/db/prisma";

const rlsTestUserIds = ["rls-test-user-a", "rls-test-user-b"] as const;

describe.skipIf(process.env.RLS_TEST_ENABLED !== "true")(
  "Todo PostgreSQL row security",
  () => {
    let firstUserId = "";
    let secondUserId = "";
    let adminUserId = "";
    const createdIds: string[] = [];

    beforeAll(async () => {
      const users = await prisma.user.findMany({
        where: { id: { in: [...rlsTestUserIds] } },
        select: { id: true },
        orderBy: { id: "asc" },
      });
      if (users.length !== 2) throw new Error("Expected two RLS test users");
      firstUserId = users[0].id;
      secondUserId = users[1].id;
      const admin = await prisma.user.findFirst({
        where: { isAdmin: true },
        select: { id: true },
      });
      if (!admin) throw new Error("Expected a seeded admin user");
      adminUserId = admin.id;
    });

    afterAll(async () => {
      for (const userId of [firstUserId, secondUserId]) {
        if (!userId) continue;
        await withUserDbContext(userId, () =>
          prisma.todo.deleteMany({ where: { id: { in: createdIds } } }),
        );
      }
      await prisma.$disconnect();
    });

    it("defaults to no rows when user context is missing", async () => {
      await expect(prisma.todo.findMany()).resolves.toEqual([]);
      await expect(
        prisma.todo.create({
          data: {
            title: "[rls-test] missing context",
            userId: firstUserId,
          },
        }),
      ).rejects.toThrow();
    });

    it("rolls back a failed action and returns the pooled client to fail-closed state", async () => {
      const title = "[rls-test] rolled back action";
      await expect(
        withUserDbContext(firstUserId, async (tx) => {
          await tx.todo.create({
            data: { title, userId: firstUserId },
          });
          throw new Error("force transaction rollback");
        }),
      ).rejects.toThrow("force transaction rollback");

      await expect(prisma.todo.findMany({ where: { title } })).resolves.toEqual(
        [],
      );
      await expect(
        prisma.todo.create({
          data: { title: "[rls-test] context leaked", userId: firstUserId },
        }),
      ).rejects.toThrow();
    });

    it("isolates concurrent users and rejects forged ownership", async () => {
      const first = await withUserDbContext(firstUserId, () =>
        prisma.todo.create({
          data: { title: "[rls-test] first", userId: firstUserId },
          select: { id: true },
        }),
      );
      const second = await withUserDbContext(secondUserId, () =>
        prisma.todo.create({
          data: { title: "[rls-test] second", userId: secondUserId },
          select: { id: true },
        }),
      );
      createdIds.push(first.id, second.id);

      const [firstRows, secondRows, adminRows] = await Promise.all([
        withUserDbContext(firstUserId, () =>
          prisma.todo.findMany({ select: { id: true } }),
        ),
        withUserDbContext(secondUserId, () =>
          prisma.todo.findMany({ select: { id: true } }),
        ),
        withUserDbContext(adminUserId, (tx) =>
          tx.todo.findMany({
            where: { id: { in: [first.id, second.id] } },
            select: { id: true },
          }),
        ),
      ]);
      expect(firstRows).toContainEqual({ id: first.id });
      expect(firstRows).not.toContainEqual({ id: second.id });
      expect(secondRows).toContainEqual({ id: second.id });
      expect(secondRows).not.toContainEqual({ id: first.id });
      expect(adminRows).toEqual([]);

      await expect(
        withUserDbContext(secondUserId, () =>
          prisma.todo.create({
            data: { title: "[rls-test] forged", userId: firstUserId },
          }),
        ),
      ).rejects.toThrow();

      await expect(
        prisma.todo.findMany({ where: { id: { in: createdIds } } }),
      ).resolves.toEqual([]);

      await expect(
        withUserDbContext(secondUserId, () =>
          prisma.todo.update({
            where: { id: first.id },
            data: { title: "[rls-test] cross-owner update" },
          }),
        ),
      ).rejects.toThrow();
      await expect(
        withUserDbContext(secondUserId, () =>
          prisma.todo.delete({ where: { id: first.id } }),
        ),
      ).rejects.toThrow();
      await expect(
        withUserDbContext(secondUserId, () =>
          prisma.todo.updateMany({
            where: { id: first.id },
            data: { completed: true },
          }),
        ),
      ).resolves.toEqual({ count: 0 });
      await expect(
        withUserDbContext(secondUserId, () =>
          prisma.todo.deleteMany({ where: { id: first.id } }),
        ),
      ).resolves.toEqual({ count: 0 });
      await expect(
        withUserDbContext(firstUserId, () =>
          prisma.todo.update({
            where: { id: first.id },
            data: { userId: secondUserId },
          }),
        ),
      ).rejects.toThrow();

      await expect(
        withUserDbContext(firstUserId, () =>
          prisma.todo.findUnique({
            where: { id: first.id },
            select: { userId: true, completed: true },
          }),
        ),
      ).resolves.toEqual({ userId: firstUserId, completed: false });
    });
  },
);
