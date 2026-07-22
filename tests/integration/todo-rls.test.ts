import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { prisma, withUserDbContext } from "@/lib/db/prisma";

describe.skipIf(process.env.RLS_TEST_ENABLED !== "true")(
  "Todo PostgreSQL row security",
  () => {
    let firstUserId = "";
    let secondUserId = "";
    const createdIds: string[] = [];

    beforeAll(async () => {
      const users = await prisma.user.findMany({
        select: { id: true },
        orderBy: { id: "asc" },
        take: 2,
      });
      if (users.length < 2) throw new Error("Expected two seeded users");
      firstUserId = users[0].id;
      secondUserId = users[1].id;
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

    it("runs as a non-owner role without BYPASSRLS", async () => {
      const [role] = await prisma.$queryRaw<
        {
          currentUser: string;
          owner: boolean;
          bypassRls: boolean;
          inheritsRoles: boolean;
        }[]
      >(Prisma.sql`
      SELECT
        current_user AS "currentUser",
        (current_user = tableowner) AS owner,
        rolbypassrls AS "bypassRls",
        rolinherit AS "inheritsRoles"
      FROM pg_tables
      JOIN pg_roles ON rolname = current_user
      WHERE schemaname = 'public' AND tablename = 'Todo'
    `);
      expect(role).toEqual({
        currentUser: "life_ustc_runtime",
        owner: false,
        bypassRls: false,
        inheritsRoles: false,
      });
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

      const [firstRows, secondRows] = await Promise.all([
        withUserDbContext(firstUserId, () =>
          prisma.todo.findMany({ select: { id: true } }),
        ),
        withUserDbContext(secondUserId, () =>
          prisma.todo.findMany({ select: { id: true } }),
        ),
      ]);
      expect(firstRows).toContainEqual({ id: first.id });
      expect(firstRows).not.toContainEqual({ id: second.id });
      expect(secondRows).toContainEqual({ id: second.id });
      expect(secondRows).not.toContainEqual({ id: first.id });

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
    });
  },
);
