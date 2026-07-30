import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma, withUserDbContext } from "@/lib/db/prisma";

const rlsTestUserIds = ["rls-test-user-a", "rls-test-user-b"] as const;

describe.skipIf(process.env.RLS_TEST_ENABLED !== "true")(
  "UserSectionSubscription PostgreSQL row security",
  () => {
    let firstUserId = "";
    let secondUserId = "";
    let sectionId = 0;

    beforeAll(async () => {
      const users = await prisma.user.findMany({
        where: { id: { in: [...rlsTestUserIds] } },
        select: { id: true },
        orderBy: { id: "asc" },
      });
      if (users.length !== 2) throw new Error("Expected two RLS test users");
      firstUserId = users[0].id;
      secondUserId = users[1].id;

      const section = await prisma.section.findFirst({
        select: { id: true },
        orderBy: { id: "asc" },
      });
      if (!section) throw new Error("Expected a seeded section");
      sectionId = section.id;
    });

    beforeEach(async () => {
      await prisma.userSectionSubscription.deleteMany({
        where: { userId: { in: [firstUserId, secondUserId] } },
      });
    });

    afterAll(async () => {
      await prisma.userSectionSubscription.deleteMany({
        where: { userId: { in: [firstUserId, secondUserId] } },
      });
      await prisma.$disconnect();
    });

    it("defaults to no rows or writes without an owner context", async () => {
      await expect(prisma.userSectionSubscription.findMany()).resolves.toEqual(
        [],
      );
      await expect(
        prisma.userSectionSubscription.create({
          data: { sectionId, userId: firstUserId },
        }),
      ).rejects.toThrow();
    });

    it("isolates owners and rejects forged ownership", async () => {
      await withUserDbContext(firstUserId, (tx) =>
        tx.userSectionSubscription.create({
          data: { sectionId, userId: firstUserId },
        }),
      );

      await expect(
        withUserDbContext(firstUserId, (tx) =>
          tx.userSectionSubscription.findMany({
            select: { sectionId: true, userId: true },
          }),
        ),
      ).resolves.toEqual([{ sectionId, userId: firstUserId }]);

      await expect(
        withUserDbContext(secondUserId, (tx) =>
          tx.userSectionSubscription.findMany({
            where: { sectionId },
          }),
        ),
      ).resolves.toEqual([]);

      await expect(
        withUserDbContext(secondUserId, (tx) =>
          tx.userSectionSubscription.create({
            data: { sectionId, userId: firstUserId },
          }),
        ),
      ).rejects.toThrow();
    });
  },
);
