import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setHomeworkCompletion } from "@/features/homeworks/server/homework-completion";
import { prisma, withUserDbContext } from "@/lib/db/prisma";

const ownerUserId = "rls-test-user-a";
const otherUserId = "rls-test-user-b";

describe.skipIf(process.env.RLS_TEST_ENABLED !== "true")(
  "HomeworkCompletion PostgreSQL row security",
  () => {
    let homeworkId = "";

    async function clearCompletion(userId: string) {
      await withUserDbContext(userId, (tx) =>
        tx.homeworkCompletion.deleteMany({
          where: { userId, homeworkId },
        }),
      );
    }

    beforeAll(async () => {
      const homework = await prisma.homework.findFirst({
        where: { deletedAt: null },
        orderBy: { id: "asc" },
        select: { id: true },
      });
      if (!homework) throw new Error("Expected a seeded homework");
      homeworkId = homework.id;
    });

    beforeEach(async () => {
      await Promise.all([
        clearCompletion(ownerUserId),
        clearCompletion(otherUserId),
      ]);
    });

    afterAll(async () => {
      if (homeworkId) {
        await Promise.all([
          clearCompletion(ownerUserId),
          clearCompletion(otherUserId),
        ]);
      }
      await prisma.$disconnect();
    });

    it("enables forced RLS with only the owner isolation policy", async () => {
      const [table] = await prisma.$queryRaw<
        { rlsEnabled: boolean; rlsForced: boolean }[]
      >`
        SELECT
          relrowsecurity AS "rlsEnabled",
          relforcerowsecurity AS "rlsForced"
        FROM pg_class
        JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
        WHERE pg_namespace.nspname = 'public'
          AND pg_class.relname = 'HomeworkCompletion'
      `;
      expect(table).toEqual({ rlsEnabled: true, rlsForced: true });

      const policies = await prisma.$queryRaw<
        {
          policyName: string;
          command: string;
          usingExpression: string | null;
          checkExpression: string | null;
        }[]
      >`
        SELECT
          policyname AS "policyName",
          cmd AS command,
          qual AS "usingExpression",
          with_check AS "checkExpression"
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'HomeworkCompletion'
      `;
      expect(policies).toHaveLength(1);
      const ownerPolicy = policies.find(
        ({ policyName }) => policyName === "HomeworkCompletion_owner_isolation",
      );
      expect(ownerPolicy).toMatchObject({
        policyName: "HomeworkCompletion_owner_isolation",
        command: "ALL",
      });
      expect(ownerPolicy?.usingExpression?.replaceAll("::text", "")).toBe(
        `("userId" = NULLIF(current_setting('app.user_id', true), ''))`,
      );
      expect(ownerPolicy?.checkExpression?.replaceAll("::text", "")).toBe(
        ownerPolicy?.usingExpression?.replaceAll("::text", ""),
      );
    });

    it("fails closed when the user context is missing", async () => {
      await expect(prisma.homeworkCompletion.findMany()).resolves.toEqual([]);
      await expect(
        prisma.homeworkCompletion.create({
          data: { userId: ownerUserId, homeworkId },
        }),
      ).rejects.toThrow();
    });

    it("keeps service reads and writes isolated to the owner", async () => {
      await expect(
        setHomeworkCompletion({
          completed: true,
          homeworkId,
          userId: ownerUserId,
        }),
      ).resolves.toMatchObject({ success: true, completed: true });

      await expect(
        withUserDbContext(ownerUserId, (tx) =>
          tx.homeworkCompletion.findUnique({
            where: {
              userId_homeworkId: { userId: ownerUserId, homeworkId },
            },
            select: { userId: true },
          }),
        ),
      ).resolves.toEqual({ userId: ownerUserId });
      await expect(
        withUserDbContext(otherUserId, (tx) =>
          tx.homeworkCompletion.findUnique({
            where: {
              userId_homeworkId: { userId: ownerUserId, homeworkId },
            },
          }),
        ),
      ).resolves.toBeNull();

      await expect(
        setHomeworkCompletion({
          completed: false,
          homeworkId,
          userId: otherUserId,
        }),
      ).resolves.toMatchObject({ success: true, completed: false });
      await expect(
        withUserDbContext(ownerUserId, (tx) =>
          tx.homeworkCompletion.findUnique({
            where: {
              userId_homeworkId: { userId: ownerUserId, homeworkId },
            },
          }),
        ),
      ).resolves.not.toBeNull();
    });

    it("rejects forged ownership and cross-owner mutation", async () => {
      await setHomeworkCompletion({
        completed: true,
        homeworkId,
        userId: ownerUserId,
      });

      await expect(
        withUserDbContext(otherUserId, (tx) =>
          tx.homeworkCompletion.create({
            data: { userId: ownerUserId, homeworkId },
          }),
        ),
      ).rejects.toThrow();
      await expect(
        withUserDbContext(otherUserId, (tx) =>
          tx.homeworkCompletion.updateMany({
            where: { userId: ownerUserId, homeworkId },
            data: { completedAt: new Date() },
          }),
        ),
      ).resolves.toEqual({ count: 0 });
      await expect(
        withUserDbContext(otherUserId, (tx) =>
          tx.homeworkCompletion.deleteMany({
            where: { userId: ownerUserId, homeworkId },
          }),
        ),
      ).resolves.toEqual({ count: 0 });
      await expect(
        withUserDbContext(ownerUserId, (tx) =>
          tx.homeworkCompletion.update({
            where: {
              userId_homeworkId: { userId: ownerUserId, homeworkId },
            },
            data: { userId: otherUserId },
          }),
        ),
      ).rejects.toThrow();
    });
  },
);
